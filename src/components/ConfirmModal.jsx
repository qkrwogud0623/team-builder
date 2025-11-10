/**
 * 확인이 필요한 상황에서 메시지를 보여주는 모달 컴포넌트다.
 */
import React from "react";
import styles from "./ConfirmModal.module.css";

// 확인과 취소 버튼을 제공하는 기본 모달을 랜더링한다.
function ConfirmModal({ title, message, onConfirm, onClose }) {
  const handleContentClick = (e) => e.stopPropagation();

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={handleContentClick}>
        <h2 className={styles.modalTitle}>{title}</h2>
        <p className={styles.modalMessage}>{message}</p>
        <div className={styles.modalActions}>
          <button
            className={`${styles.modalButton} ${styles.cancelButton}`}
            onClick={onClose}
          >
            취소
          </button>
          <button
            className={`${styles.modalButton} ${styles.confirmButton}`}
            onClick={onConfirm}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
