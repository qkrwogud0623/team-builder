/**
 * @file ConfirmModal.jsx
 * @description
 * 재사용 가능한 확인/취소 모달 컴포넌트입니다.
 */
import React from 'react';
import styles from './ConfirmModal.module.css';

function ConfirmModal({ title, message, onConfirm, onClose }) {
  const handleContentClick = (e) => e.stopPropagation();

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={handleContentClick}>
        <h2 className={styles.modalTitle}>{title}</h2>
        <p className={styles.modalMessage}>{message}</p>
        <div className={styles.modalActions}>
          <button className={`${styles.modalButton} ${styles.cancelButton}`} onClick={onClose}>
            취소
          </button>
          <button className={`${styles.modalButton} ${styles.confirmButton}`} onClick={onConfirm}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

// 👇 이 부분이 가장 중요합니다!
export default ConfirmModal;