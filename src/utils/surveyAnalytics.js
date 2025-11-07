/**
 * @file surveyAnalytics.js
 * @description
 * 사용자 설문조사 결과를 바탕으로 가장 유사한 선수를 찾는
 * 모든 데이터 분석 로직을 포함하는 유틸리티 파일입니다.
 * 이 파일은 React에 의존하지 않는 순수 JavaScript 함수로 구성됩니다.
 */

// --- 분석 모델 하이퍼파라미터 (설정값) ---
const USE_WEIGHTED = true;      // 포지션별 가중치 적용 여부
const USE_HYBRID_SCORE = true;  // 코사인 유사도 + 역거리 점수 혼합 사용 여부
const COSINE_WEIGHT = 0.8;      // 코사인 유사도 점수 가중치
const INVDIST_WEIGHT = 0.2;     // 역거리 점수 가중치
const SAFE_BASE = 60;           // 스탯이 0일 경우를 대비한 기본값

// --- 포지션별 스탯 가중치 ---
const WEIGHTS_BY_POS = {
  ST:  { PAC: 1.1, SHO: 1.4, PAS: 1.0, DRI: 1.2, DEF: 0.7, PHY: 1.1 },
  CAM: { PAC: 1.0, SHO: 1.0, PAS: 1.4, DRI: 1.2, DEF: 0.8, PHY: 0.9 },
  CM:  { PAC: 0.9, SHO: 1.0, PAS: 1.4, DRI: 1.1, DEF: 1.0, PHY: 1.0 },
  CDM: { PAC: 0.9, SHO: 0.8, PAS: 1.1, DRI: 0.9, DEF: 1.5, PHY: 1.2 },
  CB:  { PAC: 0.8, SHO: 0.7, PAS: 0.9, DRI: 0.8, DEF: 1.6, PHY: 1.3 },
  LB:  { PAC: 1.1, SHO: 0.7, PAS: 1.0, DRI: 1.0, DEF: 1.4, PHY: 1.1 },
  LW:  { PAC: 1.3, SHO: 1.2, PAS: 1.1, DRI: 1.4, DEF: 0.8, PHY: 0.9 },
  // RW, RB는 각각 LW, LB의 가중치를 공유하여 사용 (아래 함수 로직 참고)
};

// --- Helper Functions (내부 계산 함수) ---

/** 코사인 유사도 계산 */
const cosineSimilarity = (vecA, vecB) => {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] ** 2;
    normB += vecB[i] ** 2;
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
};

/** 유클리드 거리 계산 */
const euclideanDistance = (vecA, vecB) => {
  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    sum += (vecA[i] - vecB[i]) ** 2;
  }
  return Math.sqrt(sum);
};

/** 거리를 정규화된 역수(유사도)로 변환 */
const normalizedInverseDistance = (dist, maxDist = 25) => 1 - Math.min(dist / maxDist, 1);

/** 스탯 객체를 포지션 가중치가 적용된 벡터(배열)로 변환 */
const applyWeightsToStats = (statsObj, position) => {
  // RW -> LW, RB -> LB 가중치 맵핑
  let positionKey = position;
  if (position === 'RW') positionKey = 'LW';
  if (position === 'RB') positionKey = 'LB';

  const weights = (USE_WEIGHTED && WEIGHTS_BY_POS[positionKey])
    ? WEIGHTS_BY_POS[positionKey]
    : { PAC: 1, SHO: 1, PAS: 1, DRI: 1, DEF: 1, PHY: 1 };

  const statOrder = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'];
  return statOrder.map(stat => (statsObj[stat] ?? SAFE_BASE) * (weights[stat] || 1));
};


// --- Main Export Function (외부 호출 함수) ---

/**
 * 사용자 스탯과 포지션을 기반으로 가장 유사한 상위 5명의 선수를 찾습니다.
 * @param {object} userStats - 사용자의 최종 스탯 객체 (e.g., { PAC: 75, ... })
 * @param {array} allPlayers - 비교할 모든 선수 데이터 배열
 * @param {string} position - 사용자가 선택한 포지션
 * @returns {array} - 상위 5명 선수의 정보가 담긴 배열
 */
export const findTopMatchingPlayers = (userStats, allPlayers, position) => {
  if (!userStats || !allPlayers || !position) return [];

  const userVector = applyWeightsToStats(userStats, position);

  const similarities = allPlayers.map(player => {
    const playerVector = applyWeightsToStats(player, position);
    const cosSim = cosineSimilarity(userVector, playerVector);
    const dist = euclideanDistance(userVector, playerVector);
    const invDistScore = normalizedInverseDistance(dist);

    const finalScore = USE_HYBRID_SCORE
      ? (COSINE_WEIGHT * cosSim + INVDIST_WEIGHT * invDistScore)
      : cosSim;

    return {
      name: player.Name,
      team: player.Team,
      ovr: player.OVR,
      score: finalScore,
    };
  });

  // 점수가 높은 순으로 정렬하여 상위 5명 반환
  return similarities.sort((a, b) => b.score - a.score).slice(0, 5);
};
