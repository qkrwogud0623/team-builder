/**
 * @file LoginPage.jsx
 * @description
 * 사용자가 이메일과 비밀번호로 로그인하는 페이지 컴포넌트입니다.
 * - Firebase Authentication을 사용하여 로그인 기능을 구현합니다.
 * - 로그인 시도 중 발생하는 에러를 사용자에게 표시합니다.
 * - CSS Modules를 사용하여 컴포넌트의 스타일을 독립적으로 관리합니다.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from '../firebase';

// [리팩토링] App.css 대신, 이 컴포넌트만을 위한 전용 CSS 파일을 불러옵니다.
import styles from './LoginPage.module.css';

function LoginPage() {
  // --- 상태 관리 (State Management) ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(''); // [리팩토링] alert()를 대체할 에러 메시지 상태
  const navigate = useNavigate();

  /**
   * [리팩토링] async/await를 사용한 로그인 처리 함수
   * @description 입력된 이메일과 비밀번호로 Firebase 로그인을 시도합니다.
   */
  const handleLogin = async (e) => {
    e.preventDefault(); // form 태그 사용 시 새로고침 방지
    setError(''); // 이전 에러 메시지 초기화

    // 입력값 유효성 검사
    if (!email || !password) {
      setError('이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }

    try {
      // Firebase 이메일/비밀번호 로그인 함수
      await signInWithEmailAndPassword(auth, email, password);
      // 로그인 성공 시 메인 페이지로 이동 (App.jsx의 라우팅 로직에 의해 자동으로 처리됨)
      // navigate('/'); // 명시적으로 이동시킬 수도 있습니다.
    } catch (err) {
      // 로그인 실패 시 사용자에게 친절한 에러 메시지를 보여줍니다.
      console.error("Login Error:", err); // 개발자를 위해 콘솔에는 상세 에러를 출력
      setError('이메일 또는 비밀번호가 잘못되었습니다.');
    }
  };

  // --- 렌더링 ---
  return (
    <div className={styles.authContainer}>
      <div className={styles.authContent}>
        {/* [리팩토링] 더 나은 접근성을 위해 form 태그로 감싸줍니다. */}
        <form className={styles.formWrapper} onSubmit={handleLogin}>
          <h2 className={styles.authTitle}>다시 오셨네요!</h2>
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
            placeholder="비밀번호"
            aria-label="비밀번호"
          />
        </form>
        <div className={styles.authFooter}>
          {/* [리팩토링] 에러 메시지를 화면에 표시합니다. */}
          {error && <p className={styles.errorMessage}>{error}</p>}
          <button type="submit" className={styles.authButton} onClick={handleLogin}>
            로그인
          </button>
          <p className={styles.authToggleLink}>
            계정이 없으신가요? <Link to="/signup">회원가입</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
