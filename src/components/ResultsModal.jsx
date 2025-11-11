/**
 * 경기 결과와 투표 통계를 보여주는 모달이다.
 */
import React from "react";
import { createPortal } from "react-dom";
import modalStyles from "./CreateMatchModal.module.css";
import styles from "./ResultsModal.module.css";

const VOTE_CATEGORIES = [
  { id: "bomber", text: "✈️ 폭격기 (Best Attacker)", stats: ["SHO", "PAC"] },
  { id: "midfielder", text: "🧠 중원의 지배자 (Best Midfielder)", stats: ["PAS", "DRI"] },
  { id: "defender", text: "🔒 빗장수비 (Best Defender)", stats: ["DEF", "PHY"] },
  { id: "goalkeeper", text: "🧤 거미손 (Best Goalkeeper)", stats: ["PHY", "DEF"] },
];

// 투표 항목별로 결과 목록을 출력한다.
const ResultCategory = ({ title, results = [] }) => (
  <section className={styles.category}>
    <h4 className={styles.categoryTitle}>{title} 득표</h4>
    {results.length === 0 ? (
      <div className={styles.noVotes}>득표 없음</div>
    ) : (
      <ul className={styles.resultsList}>
        {results.map((r) => (
          <li key={`${title}-${r.uid}`} className={styles.resultItem}>
            <span>{r.name}</span>
            <span>{r.cnt}표</span>
          </li>
        ))}
      </ul>
    )}
  </section>
);

// 경기 요약과 각 카테고리 투표 결과를 모달로 띄운다.
export const ResultsModal = ({ open, onClose, match, data }) => {
  if (!open || !match || !data) {
    return null;
  }

  // 경기 정보(whenStr) 관련 로직 삭제됨

  return createPortal(
    <div className={modalStyles.overlay} onMouseDown={onClose}>
      <div
        className={modalStyles.content}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={modalStyles.header}>
          <h3 className={modalStyles.title}>경기 결과</h3>
          <button className={modalStyles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>
        
        <div 
          className={`${modalStyles.body} ${styles.body}`}
          style={{ paddingTop: '0px' }}
        >
          {/* 경기 정보 <p> 태그 삭제됨 */}
          
          {/* 투표 결과 목록만 바로 시작 */}
          {VOTE_CATEGORIES.map((cat) => (
            <ResultCategory
              key={cat.id}
              title={cat.text}
              results={data[cat.id]}
            />
          ))}
        </div>

        <div className={modalStyles.footer}>
          <button
            className={`${modalStyles.button} ${modalStyles.secondary}`}
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};