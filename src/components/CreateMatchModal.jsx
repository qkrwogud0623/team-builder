/**
 * 경기 생성 모달로 날짜, 시간, 장소를 지정해 새로운 경기를 등록한다.
 */
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  addDoc,
  collection,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";
import DatePicker from "react-datepicker";
import { ko } from "date-fns/locale";
import { isSameDay, setHours, setMinutes, startOfToday } from "date-fns";

import styles from "./CreateMatchModal.module.css";
import "react-datepicker/dist/react-datepicker.css";
import "../styles/datepicker.css";

// 경기 정보를 입력받아 팀 컬렉션에 저장한다.
export const CreateMatchModal = ({ teamId, onClose }) => {
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const now = new Date();
  const minTime = isSameDay(date, now)
    ? setMinutes(
        setHours(now, now.getHours()),
        Math.ceil(now.getMinutes() / 15) * 15,
      )
    : setHours(setMinutes(new Date(), 0), 0);
  const maxTime = setHours(setMinutes(new Date(), 45), 23);

  // 입력값 검증 후 Firestore에 경기를 생성한다.
  const handleCreateMatch = async () => {
    setError("");

    if (!date || !time || !location.trim()) {
      setError("날짜, 시간, 장소를 모두 입력해주세요.");
      return;
    }
    const combinedDateTime = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      time.getHours(),
      time.getMinutes(),
    );
    if (combinedDateTime < new Date()) {
      setError("현재 시간 이후로만 경기를 생성할 수 있습니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "teams", teamId, "matches"), {
        when: Timestamp.fromDate(combinedDateTime),
        location: location.trim(),
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        status: "pending",
      });
      onClose();
    } catch (e) {
      console.error("Match creation error:", e);
      setError("경기 생성 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.content} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>새로운 경기 만들기</h2>
          <button
            type="button"
            aria-label="닫기"
            className={styles.closeButton}
            onClick={onClose}
          >
            ×
          </button>
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
            <button
              type="button"
              className={`${styles.button} ${styles.secondary}`}
              onClick={onClose}
            >
              취소
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.primary}`}
              onClick={handleCreateMatch}
              disabled={isSubmitting}
            >
              {isSubmitting ? "생성 중..." : "생성하기"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
