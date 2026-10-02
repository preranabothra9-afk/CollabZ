import { db } from './database';
import { getGeminiTextResponse } from './ai';
import { generateUUID } from './auth';
import { Claim, ClaimRelation, ClaimRelationship } from '../src/types';

// ---------------------------------------------------------------------------
// Contradiction graph.
//
// When a room gains new claims, they are measured against the claims already
// established there. A cheap lexical pre-filter keeps the number of model calls
// small and relevant; only the surviving candidate pairs are sent to the
// detector, which classifies each as SUPPORT, CONTRADICT, RELATED or UNCERTAIN.
//
// The detector is only ever asked to *classify* the relationship. It is
// explicitly forbidden from deciding which claim is true — adjudication stays
// with the people in the room.
// ---------------------------------------------------------------------------

/** How many existing claims one new claim is measured against, at most. */
const MAX_CANDIDATES_PER_CLAIM = 5;
/** Hard ceiling on detector calls for one submission round. */
const MAX_DETECTIONS_PER_ROUND = 8;

const RELATIONSHIPS: ClaimRelationship[] = ['SUPPORT', 'CONTRADICT', 'RELATED', 'UNCERTAIN'];

const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'has', 'are',
  'was', 'were', 'will', 'would', 'could', 'should', 'not', 'but', 'they',
  'their', 'there', 'then', 'than', 'into', 'been', 'also', 'such', 'each',
  'which', 'your', 'about', 'after', 'before', 'between', 'during', 'without',
  'because', 'while', 'may', 'can', 'all', 'any', 'its', 'his', 'her', 'our',
  'every', 'some', 'other', 'more', 'most', 'only', 'just', 'very', 'much',
  // Generic verbs that appear in nearly every technical claim but carry no
  // subject identity — leaving them in makes unrelated claims look related.
  'use', 'uses', 'used', 'using', 'based', 'run', 'runs', 'running', 'ran',
  'make', 'makes', 'made', 'get', 'gets', 'got', 'set', 'sets', 'setting',
  'work', 'works', 'worked', 'working', 'provide', 'provides', 'provided',
  'support', 'supports', 'supported', 'allow', 'allows', 'allowed', 'using',
]);

/** Canonical, order-independent key for a claim pair so (A,B) === (B,A). */
function pairKey(claimAId: string, claimBId: string): string {
  return [claimAId, claimBId].sort().join('|');
}

/** Lowercase content tokens: alphanumeric runs of 3+ chars, stopwords dropped. */
function contentTokens(text: string): Set<string> {
  const tokens = new Set<string>();
  const matches = text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  for (const token of matches) if (!STOPWORDS.has(token)) tokens.add(token);
  return tokens;
}

/**
 * Cheap lexical relevance pre-filter. Contradicting claims are nearly always
 * about the same subject, so shared vocabulary is a good proxy for "worth
 * comparing" and keeps the detector off unrelated pairs entirely. Candidates
 * are ranked by Jaccard similarity and truncated, bounding the model calls.
 */
export function findRelevantCandidates(
  newClaim: Claim,
  existingClaims: Claim[],
  limit = MAX_CANDIDATES_PER_CLAIM
): Claim[] {
  const newTokens = contentTokens(newClaim.text);
  if (newTokens.size === 0) return [];

  return existingClaims
    .filter((claim) => claim.id !== newClaim.id)
    .map((claim) => {
      const tokens = contentTokens(claim.text);
      if (tokens.size === 0) return { claim, score: 0 };
      let shared = 0;
      for (const token of newTokens) if (tokens.has(token)) shared++;
      const union = newTokens.size + tokens.size - shared;
      return { claim, score: union === 0 ? 0 : shared / union };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.claim);
}

/** Parses the detector's JSON verdict, tolerating prose or code fences. */
export function parseVerdict(raw: string): { relationship: ClaimRelationship; confidence: number; explanation: string } | null {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenceMatch ? fenceMatch[1] : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  let parsed: any;
  try {
    parsed = JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }

  const relationship = String(parsed?.relationship ?? '').toUpperCase() as ClaimRelationship;
  if (!RELATIONSHIPS.includes(relationship)) return null;

  const confidence = Number(parsed?.confidence);
  return {
    relationship,
    confidence: Number.isFinite(confidence) ? Math.min(Math.max(confidence, 0), 1) : 0.5,
    explanation: String(parsed?.explanation ?? '').trim().slice(0, 300)
  };
}

/**
 * Asks the detector to classify one claim pair. Any failure — missing key,
 * rate limit, unparseable reply — resolves to null so the caller can skip the
 * pair rather than store a half-formed edge.
 */
export async function classifyRelationship(claimA: Claim, claimB: Claim): Promise<ClaimRelation | null> {
  const prompt = [
    'You are a contradiction detector in a collaborative AI workspace.',
    'Two claims extracted from AI responses in the same discussion room are given.',
    'Judge only the relationship between them.',
    '',
    'Claim A: "' + claimA.text + '"',
    'Claim B: "' + claimB.text + '"',
    '',
    'Reply with ONLY a JSON object, no prose and no code fences, in this exact shape:',
    '{"relationship": "CONTRADICT", "confidence": 0.85, "explanation": "one short sentence"}',
    '',
    '"relationship" is one of:',
    '- SUPPORT: both claims assert the same underlying fact',
    '- CONTRADICT: the claims cannot both be true at the same time',
    '- RELATED: they concern the same topic but neither support nor contradict each other',
    '- UNCERTAIN: there is not enough information to decide',
    '',
    '"confidence" is a number from 0 to 1 reflecting how clear the verdict is.',
    '',
    'CRITICAL RULE: you only detect the relationship. NEVER decide or imply which',
    'claim is correct, which is newer, or which source to trust. The explanation',
    'must describe how the two claims relate and must never adjudicate between them.',
    '',
    'Reply with the JSON object only.'
  ].join('\n');

  const raw = await getGeminiTextResponse(prompt);
  const verdict = parseVerdict(raw);
  if (!verdict || !verdict.explanation) return null;

  return {
    id: generateUUID(),
    conversationId: claimA.conversationId,
    claimAId: claimA.id,
    claimBId: claimB.id,
    claimAText: claimA.text,
    claimBText: claimB.text,
    claimAModelName: claimA.modelName,
    claimBModelName: claimB.modelName,
    relationship: verdict.relationship,
    confidence: verdict.confidence,
    explanation: verdict.explanation,
    status: 'detected',
    createdAt: new Date().toISOString()
  };
}

// Pair keys currently being classified, so concurrent submission rounds don't
// pay twice for the same pair. Cleared as each classification settles.
const inFlight = new Set<string>();

/**
 * Measures freshly-stored claims against the room's established memory and
 * stores every new relationship found. Duplicate pairs are skipped — both here
 * (by the candidate filter and the in-flight guard) and by the schema's unique
 * index — so a room never records the same relationship twice.
 *
 * Returns the edges actually created this round, so the caller can broadcast
 * only what is new. Never throws: detection is best-effort and must not break
 * the response stream that produced the claims.
 */
export async function detectContradictions(
  conversationId: string,
  newClaims: Claim[]
): Promise<ClaimRelation[]> {
  if (!newClaims || newClaims.length === 0) return [];

  // The room's memory as it stood BEFORE this response — the fresh claims are
  // already persisted by the time this runs, so they must be filtered out to
  // keep the comparison strictly "new claim vs existing claim". Cross-model
  // comparisons still work: an earlier-finishing model's claims were saved by a
  // separate call, so they count as existing for a later-finishing model.
  const newIds = new Set(newClaims.map((c) => c.id));
  const existing = (await db.getClaims(conversationId, 60)).filter((c) => !newIds.has(c.id));
  if (existing.length === 0) return [];

  // Build the candidate pairs once for the whole round, remembering what has
  // already been related so the detector is never asked the same pair twice.
  const alreadyRelated = new Set(
    (await db.getClaimRelations(conversationId, 100)).map((rel) => pairKey(rel.claimAId, rel.claimBId))
  );

  const candidates: Array<[Claim, Claim]> = [];
  for (const fresh of newClaims) {
    for (const candidate of findRelevantCandidates(fresh, existing)) {
      const key = pairKey(fresh.id, candidate.id);
      if (alreadyRelated.has(key) || inFlight.has(key)) continue;
      if (candidates.some(([a, b]) => pairKey(a.id, b.id) === key)) continue;
      candidates.push([fresh, candidate]);
      if (candidates.length >= MAX_DETECTIONS_PER_ROUND) break;
    }
    if (candidates.length >= MAX_DETECTIONS_PER_ROUND) break;
  }

  if (candidates.length === 0) return [];

  const created: ClaimRelation[] = [];
  for (const [claimA, claimB] of candidates) {
    const key = pairKey(claimA.id, claimB.id);
    inFlight.add(key);
    try {
      const relation = await classifyRelationship(claimA, claimB);
      // A pair the detector cannot place is not stored — there is nothing to say.
      if (relation && relation.relationship !== 'UNCERTAIN') {
        const stored = await db.createClaimRelation(relation);
        if (stored) {
          created.push(stored);
          alreadyRelated.add(key);
        }
      } else {
        alreadyRelated.add(key);
      }
    } catch (err: any) {
      console.warn('[relations] detection failed for a pair:', err?.message || err);
    } finally {
      inFlight.delete(key);
    }
  }

  return created;
}
