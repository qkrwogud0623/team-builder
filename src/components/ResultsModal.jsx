/**
 * 경기 결과와 투표 통계를 보여주는 모달이다.
 */
import React from "react";
import { createPortal } from "react-dom";
import modalStyles from "./CreateMatchModal.module.css";
import styles from "./ResultsModal.module.css";

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

  const whenStr = match.when?.toDate
    ? new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(match.when.toDate())
    : "-";

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
        {}
        <div className={`${modalStyles.body} ${styles.body}`}>
          <p className={styles.matchInfo}>
            <strong>{whenStr}</strong>
            <br />
            {match.location} 경기
          </p>
          <ResultCategory title="공격" results={data.attack} />
          <ResultCategory title="수비" results={data.defense} />
          <ResultCategory title="MVP" results={data.mvp} />
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
    document.body,
  );
};
