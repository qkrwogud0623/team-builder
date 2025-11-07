/**
 * @file SignUpPage.jsx
 * @description
 * 사용자가 실명, 이메일, 비밀번호로 회원가입하는 페이지 컴포넌트입니다.
 * - Firebase Authentication을 사용하여 신규 사용자를 생성합니다.
 * - Firestore에 사용자의 기본 프로필 정보(실명, 서베이 미완료 상태 등)를 저장합니다.
 * - CSS Modules를 사용하여 LoginPage와 스타일을 공유하고 재사용합니다.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from '../firebase';

// [리팩토링] LoginPage와 동일한 스타일을 공유하므로, 해당 CSS 모듈을 그대로 가져와 사용합니다.
import styles from './LoginPage.module.css';

function SignUpPage() {
  // --- 상태 관리 (State Management) ---
  const [realName, setRealName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState(''); // alert()를 대체할 에러 메시지 상태

  /**
   * [리팩토링] async/await를 사용한 회원가입 처리 함수
   * @description 입력된 정보의 유효성을 검사하고 Firebase에 신규 사용자를 등록합니다.
   */
  const handleSignUp = async (e) => {
    e.preventDefault();
    setError(''); // 이전 에러 메시지 초기화

    // --- 입력값 유효성 검사 ---
    if (!realName || !email || !password || !passwordConfirm) {
      setError("모든 항목을 입력해주세요.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 6자리 이상으로 설정해주세요.");
      return;
    }

    try {
      // 1. Firebase Auth에 이메일과 비밀번호로 신규 사용자 생성
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Firestore 'users' 컬렉션에 해당 유저의 추가 정보 저장
      // App.jsx에서 이 정보를 바탕으로 서베이 페이지로 보낼지 결정합니다.
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        realName: realName.trim(), // 이름 앞뒤 공백 제거
        email: email,
        surveyCompleted: false // 회원가입 시에는 항상 false
      });

      // 회원가입 및 로그인 성공 후, App.jsx의 onAuthStateChanged 리스너가
      // 자동으로 사용자를 감지하여 서베이 페이지로 리다이렉트합니다.

    } catch (err) {
      console.error("Sign Up Error:", err);
      // [리팩토링] Firebase 에러 코드에 따라 사용자에게 더 친절한 메시지를 보여줍니다.
      if (err.code === 'auth/email-already-in-use') {
        setError('이미 사용 중인 이메일입니다.');
      } else if (err.code === 'auth/invalid-email') {
        setError('유효하지 않은 이메일 형식입니다.');
      } else {
        setError('회원가입 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    }
  };

  // --- 렌더링 ---
  return (
    <div className={styles.authContainer}>
      <div className={styles.authContent}>
        <form className={styles.formWrapper} onSubmit={handleSignUp}>
          <h2 className={styles.authTitle}>처음이신가요?</h2>
          <input
            className={styles.authInput}
            value={realName}
            onChange={e => setRealName(e.target.value)}
            placeholder="실명"
            aria-label="실명"
          />
          <input
            type="email"
            className={styles.authInput}
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="이메일"
            aria-label="이메일"
          />
          <input
            type="password"
            className={styles.authInput}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="비밀번호 (6자리 이상)"
            aria-label="비밀번호"
          />
          <input
            type="password"
            className={styles.authInput}
            value={passwordConfirm}
            onChange={e => setPasswordConfirm(e.target.value)}
            placeholder="비밀번호 확인"
            aria-label="비밀번호 확인"
          />
        </form>
        <div className={styles.authFooter}>
          {error && <p className={styles.errorMessage}>{error}</p>}
          <button type="submit" className={styles.authButton} onClick={handleSignUp}>
            다음
          </button>
          <p className={styles.authToggleLink}>
            이미 계정이 있으신가요? <Link to="/login">로그인</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignUpPage;
