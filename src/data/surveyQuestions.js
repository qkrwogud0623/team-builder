/**
 * @file surveyQuestions.js
 * @description 선수 유형 분석 설문지의 질문과 답변, 능력치(effects) 데이터를 관리합니다.
 * [리팩토링]
 * - LW/RW, LB/RB 간의 중복된 질문을 제거하고 하나의 객체를 공유하도록 구조를 개선했습니다.
 * - JSDoc 주석을 추가하여 파일의 역할을 명확히 했습니다.
 */

// --- 포지션별 공통 질문 세트 ---

// 측면 공격수 (LW, RW) 공통 질문
const WINGER_QUESTIONS = [
  { text: "측면에서 공을 잡았을 때, 당신의 첫 번째 선택은?", answers: [{ text: "중앙으로 파고들며 직접 슈팅", effects: { SHO: 1, DRI: 1 } }, { text: "크로스로 동료에게 기회 제공", effects: { PAS: 1.5 } }] },
  { text: "상대 풀백을 상대하는 당신의 방식은?", answers: [{ text: "스피드를 이용한 직선적인 돌파", effects: { PAC: 2 } }, { text: "현란한 발재간을 이용한 기술적 돌파", effects: { DRI: 2 } }] },
  { text: "역습 상황에서 당신의 역할은?", answers: [{ text: "빠르게 최전방으로 뛰어들어 마무리", effects: { PAC: 1, SHO: 1 } }, { text: "공을 운반하며 동료에게 패스", effects: { DRI: 1, PAS: 1 } }] },
  { text: "수비 가담 시 당신의 스타일은?", answers: [{ text: "적극적으로 압박하여 공을 뺏는다", effects: { DEF: 1, PAC: 0.5 } }, { text: "공격 전환을 위해 전방에 머무른다", effects: { SHO: 0.5, DEF: -0.5 } }] }
];

// 측면 수비수 (LB, RB) 공통 질문
const SIDEBACK_QUESTIONS = [
  { text: "상대 윙어를 막는 당신의 방식은?", answers: [{ text: "스피드 경합에서 이긴다", effects: { PAC: 1.5, DEF: 0.5 } }, { text: "깔끔한 태클로 공을 뺏는다", effects: { DEF: 2 } }] },
  { text: "공격 가담 시 당신의 주무기는?", answers: [{ text: "측면을 끝까지 돌파한 후 크로스", effects: { PAC: 1, PAS: 1 } }, { text: "중앙으로 들어오며 빌드업에 관여", effects: { DRI: 1, PAS: 1 } }] },
  { text: "수비 시 더 중요한 것은?", answers: [{ text: "상대와의 1대1 방어 능력", effects: { DEF: 1.5 } }, { text: "동료 수비수와의 협력 및 커버 플레이", effects: { DEF: 1, PAS: 0.5 } }] },
  { text: "당신은 어떤 유형의 풀백인가요?", answers: [{ text: "공격적인 오버래핑을 즐기는 풀백", effects: { PAC: 1, PAS: 1, DEF: -0.5 } }, { text: "수비에 집중하는 안정적인 풀백", effects: { DEF: 1.5, PHY: 0.5 } }] }
];

// --- 최종 질문 은행 ---
export const QUESTION_BANK = {
  // --- 공격수 (ST) ---
  'ST': [
    { text: "골문 앞에서 당신의 주무기는?", answers: [{ text: "강력하고 빠른 슈팅", effects: { SHO: 1.5, PAC: 0.5 } }, { text: "제공권 장악 후 헤더", effects: { PHY: 1, SHO: 1 } }] },
    { text: "수비수와 경합 시, 당신의 선택은?", answers: [{ text: "몸싸움으로 버티기", effects: { PHY: 1.5 } }, { text: "빠른 스피드로 돌파", effects: { PAC: 1, DRI: 0.5 } }] },
    { text: "상대 수비 라인을 무너뜨리는 당신의 움직임은?", answers: [{ text: "뒷공간으로 침투", effects: { PAC: 1.5 } }, { text: "내려와서 공을 받아주는 연계 플레이", effects: { PAS: 1, DRI: 0.5 } }] },
    { text: "당신은 어떤 유형의 득점을 더 선호하나요?", answers: [{ text: "원터치로 간결하게 마무리", effects: { SHO: 2 } }, { text: "개인 기술로 수비를 제치고 마무리", effects: { DRI: 1.5, SHO: 0.5 } }] }
  ],
  // --- 측면 공격수 (LW, RW) ---
  'LW': WINGER_QUESTIONS,
  'RW': WINGER_QUESTIONS,
  // --- 공격형 미드필더 (CAM) ---
  'CAM': [
    { text: "팀 공격의 활로를 뚫는 당신의 방식은?", answers: [{ text: "창의적인 스루패스", effects: { PAS: 2 } }, { text: "과감한 드리블 돌파", effects: { DRI: 2 } }] },
    { text: "슈팅과 패스 중 더 자신있는 것은?", answers: [{ text: "찬스가 나면 직접 해결하는 슈팅", effects: { SHO: 1.5 } }, { text: "동료에게 완벽한 기회를 만들어주는 패스", effects: { PAS: 1.5 } }] },
    { text: "공격 지역에서 당신의 움직임은?", answers: [{ text: "공을 받으러 적극적으로 움직인다", effects: { DRI: 1, PAS: 1 } }, { text: "빈 공간을 찾아 침투한다", effects: { PAC: 1, SHO: 1 } }] },
    { text: "상대의 강한 압박을 받을 때 당신의 선택은?", answers: [{ text: "화려한 탈압박 기술", effects: { DRI: 1.5 } }, { text: "빠른 2대1 패스", effects: { PAS: 1.5 } }] }
  ],
  // --- 중앙 미드필더 (CM) ---
  'CM': [
    { text: "경기 템포를 조절하는 당신의 방식은?", answers: [{ text: "빠른 전진 패스로 공격 속도를 올린다", effects: { PAS: 1.5, PAC: 0.5 } }, { text: "안정적인 볼 배급으로 점유율을 높인다", effects: { PAS: 1, DRI: 1 } }] },
    { text: "공수 상황에서 당신의 기여도는?", answers: [{ text: "공격에 더 집중한다", effects: { PAS: 1, SHO: 0.5, DEF: -0.5 } }, { text: "수비에 더 집중한다", effects: { DEF: 1, PHY: 0.5, PAS: -0.5 } }] },
    { text: "경기장 전체를 봤을 때 당신의 장점은?", answers: [{ text: "넓은 시야와 정확한 롱패스", effects: { PAS: 2 } }, { text: "지치지 않는 체력과 활동량", effects: { PHY: 1.5, PAC: 0.5 } }] },
    { text: "중원에서 당신의 주된 역할은?", answers: [{ text: "볼을 운반하는 드리블", effects: { DRI: 1.5 } }, { text: "볼을 뺏는 인터셉트", effects: { DEF: 1.5 } }] }
  ],
  // --- 수비형 미드필더 (CDM) ---
  'CDM': [
    { text: "상대 역습을 차단하는 당신의 방법은?", answers: [{ text: "전술적 파울로 영리하게 끊는다", effects: { DEF: 1, PHY: 1 } }, { text: "빠르게 수비 위치로 복귀한다", effects: { PAC: 1, DEF: 1 } }] },
    { text: "수비 시 당신의 가장 큰 장점은?", answers: [{ text: "상대의 패스 길목 차단", effects: { DEF: 2 } }, { text: "강력한 대인 방어와 태클", effects: { DEF: 1, PHY: 1 } }] },
    { text: "공을 뺏은 후 당신의 첫 번째 선택은?", answers: [{ text: "가까운 동료에게 안전하게 연결", effects: { PAS: 1.5 } }, { text: "한 번에 전방으로 길게 전환 패스", effects: { PAS: 1.5, PHY: -0.5 } }] },
    { text: "팀의 수비 라인을 보호하는 당신의 스타일은?", answers: [{ text: "포백 바로 앞에서 방패 역할을 한다", effects: { DEF: 2 } }, { text: "적극적으로 전진하며 중원을 압박한다", effects: { PHY: 1.5, PAC: 0.5 } }] }
  ],
  // --- 측면 수비수 (LB, RB) ---
  'LB': SIDEBACK_QUESTIONS,
  'RB': SIDEBACK_QUESTIONS,
  // --- 중앙 수비수 (CB) ---
  'CB': [
    { text: "상대 공격수를 막는 당신의 주특기는?", answers: [{ text: "지능적인 위치 선정과 가로채기", effects: { DEF: 2, PAC: -0.5 } }, { text: "강력한 몸싸움과 태클", effects: { DEF: 1, PHY: 1.5 } }] },
    { text: "빌드업 시 당신의 역할은?", answers: [{ text: "안전하게 가까운 동료에게 패스", effects: { PAS: 1, DEF: 0.5 } }, { text: "전방으로 향하는 정확한 롱패스", effects: { PAS: 2 } }] },
    { text: "당신이 가장 자신있는 수비 상황은?", answers: [{ text: "공중볼 경합", effects: { PHY: 2, DEF: 0.5 } }, { text: "상대의 빠른 뒷공간 침투 방어", effects: { PAC: 1, DEF: 1.5 } }] },
    { text: "수비 라인을 조율할 때 당신의 스타일은?", answers: [{ text: "적극적으로 소리치며 리드한다", effects: { DEF: 1, PAS: 0.5 } }, { text: "조용히 행동으로 보여주며 중심을 잡는다", effects: { DEF: 1.5, PHY: 0.5 } }] }
  ],
  // --- 골키퍼 (GK) ---
  'GK': [
    { text: "상대의 1대1 찬스 상황, 당신의 선택은?", answers: [{ text: "끝까지 기다리며 각을 좁힌다", effects: { DEF: 2, PHY: -0.5 } }, { text: "과감하게 전진하여 먼저 덮친다", effects: { PAC: 1, DEF: 1.5 } }] },
    { text: "강력한 중거리 슛을 막을 때 당신의 스타일은?", answers: [{ text: "안전하게 쳐낸다 (펀칭)", effects: { DEF: 1.5, PHY: 0.5 } }, { text: "어떻게든 잡아낸다 (캐칭)", effects: { DEF: 2 } }] },
    { text: "공격수에게 공을 배급하는 당신의 방식은?", answers: [{ text: "손으로 빠르고 정확하게 던져주기", effects: { PAS: 2, DEF: -0.5 } }, { text: "발로 한번에 길게 차주기", effects: { PAS: 1.5 } }] },
    { text: "상대의 크로스 상황, 당신의 판단은?", answers: [{ text: "적극적으로 나와서 공을 낚아챈다", effects: { PHY: 1.5, DEF: 1 } }, { text: "골라인에 머무르며 슈팅에 대비한다", effects: { DEF: 2 } }] }
  ]
};
