/**
 * @file CreateMatchModal.jsx
 * @description 새로운 경기를 생성하는 모달 컴포넌트입니다.
 * [리팩토링]
 * - 전용 CSS Module을 사용하여 스타일을 완전히 독립시켰습니다.
 * - alert()를 제거하고 모달 내부에 에러 메시지를 표시하도록 개선했습니다.
 * - react-datepicker에 대한 커스텀 스타일을 props로 주입하여 재사용성을 높였습니다.
 * - createPortal을 사용하여 DOM의 최상단에 렌더링되도록 구조를 유지했습니다.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { addDoc, collection, Timestamp, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase.js';
import DatePicker from 'react-datepicker';
import { ko } from 'date-fns/locale';
import { isSameDay, setHours, setMinutes, startOfToday } from 'date-fns';

// [리팩토링] 전용 CSS 모듈과 DatePicker 스타일을 불러옵니다.
import styles from './CreateMatchModal.module.css';
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/datepicker.css'; // DatePicker 전역 커스텀 스타일

export const CreateMatchModal = ({ teamId, onClose }) => {
  // --- 상태 관리 ---
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- ESC 키로 모달 닫기 ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // --- DatePicker 시간 설정 ---
  const now = new Date();
  const minTime = isSameDay(date, now)
    ? setMinutes(setHours(now, now.getHours()), Math.ceil(now.getMinutes() / 15) * 15) // 현재 시간보다 미래의 15분 단위로 설정
    : setHours(setMinutes(new Date(), 0), 0); // 다른 날짜는 00:00부터
  const maxTime = setHours(setMinutes(new Date(), 45), 23);

  // --- 이벤트 핸들러 ---
  const handleCreateMatch = async () => {
    setError('');
    
    // --- 유효성 검사 ---
    if (!date || !time || !location.trim()) {
      setError('날짜, 시간, 장소를 모두 입력해주세요.');
      return;
    }
    const combinedDateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes());
    if (combinedDateTime < new Date()) {
      setError('현재 시간 이후로만 경기를 생성할 수 있습니다.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'teams', teamId, 'matches'), {
        when: Timestamp.fromDate(combinedDateTime),
        location: location.trim(),
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        status: 'pending',
      });
      onClose(); // 성공 시 모달 닫기
    } catch (e) {
      console.error("Match creation error:", e);
      setError('경기 생성 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 렌더링 ---
  return createPortal(
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.content} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>새로운 경기 만들기</h2>
          <button type="button" aria-label="닫기" className={styles.closeButton} onClick={onClose}>×</button>
        </div>
        
        <div className={styles.body}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>경기 일시</span>
            <div className={styles.fieldRow}>
              <DatePicker
                selected={date}
                onChange={(d) => setDate(d)}
                locale={ko}
                dateFormat="yyyy.MM.dd (EEE)"
                placeholderText="날짜 선택"
                minDate={startOfToday()}
                className={styles.input}
                popperPlacement="bottom-start"
                showPopperArrow={false}
                isClearable
              />
              <DatePicker
                selected={time}
                onChange={(t) => setTime(t)}
                locale={ko}
                showTimeSelect
                showTimeSelectOnly
                timeIntervals={15}
                timeCaption="시간"
                dateFormat="HH:mm"
                placeholderText="시간 선택"
                className={styles.input}
                minTime={minTime}
                maxTime={maxTime}
                popperPlacement="bottom-start"
                showPopperArrow={false}
              />
            </div>
          </div>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>장소</span>
            <input
              className={styles.input}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="예: 아주대학교 운동장"
            />
          </label>
        </div>
        
        <div className={styles.footer}>
          {error && <p className={styles.errorMessage}>{error}</p>}
          <div className={styles.buttonGroup}>
            <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={onClose}>취소</button>
            <button type="button" className={`${styles.button} ${styles.primary}`} onClick={handleCreateMatch} disabled={isSubmitting}>
              {isSubmitting ? '생성 중...' : '생성하기'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
