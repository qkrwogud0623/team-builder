/**
 * @file ResultsModal.jsx
 * @description 경기 후 설문 결과(MVP, 공격/수비 득표)를 보여주는 모달
 * [수정]
 * - 순위, 막대그래프 등 복잡한 UI를 제거하고 깔끔한 목록 형태로 변경
 */
import React from 'react';
import { createPortal } from 'react-dom';
import modalStyles from './CreateMatchModal.module.css';
import styles from './ResultsModal.module.css';

// 각 카테고리를 렌더링하는 작은 컴포넌트
const ResultCategory = ({ title, results = [] }) => (
  <section className={styles.category}>
    <h4 className={styles.categoryTitle}>{title} 득표</h4>
    {results.length === 0 ? (
      <div className={styles.noVotes}>득표 없음</div>
    ) : (
      <ul className={styles.resultsList}>
        {results.map(r => (
          <li key={`${title}-${r.uid}`} className={styles.resultItem}>
            <span>{r.name}</span>
            <span>{r.cnt}표</span>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export const ResultsModal = ({ open, onClose, match, data }) => {
  if (!open || !match || !data) {
    return null;
  }

  const whenStr = match.when?.toDate
    ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(match.when.toDate())
    : '-';

  return createPortal(
    <div className={modalStyles.overlay} onMouseDown={onClose}>
      <div className={modalStyles.content} onMouseDown={(e) => e.stopPropagation()}>
        <div className={modalStyles.header}>
          <h3 className={modalStyles.title}>경기 결과</h3>
          <button className={modalStyles.closeButton} onClick={onClose}>×</button>
        </div>
        {/* [수정] body 클래스 추가 */}
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
          <button className={`${modalStyles.button} ${modalStyles.secondary}`} onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

