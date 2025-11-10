/**
 * 로그인 페이지로 이메일과 비밀번호 입력 및 오류 안내를 처리한다.
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import styles from "./LoginPage.module.css";

// 이메일과 비밀번호 입력을 받아 로그인 요청을 보낸다.
function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // 로그인 버튼 클릭 시 인증을 수행한다.
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("이메일과 비밀번호를 모두 입력해주세요.");

      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error("Login Error:", err);

      setError("이메일 또는 비밀번호가 잘못되었습니다.");
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authContent}>
        {}

        <form className={styles.formWrapper} onSubmit={handleLogin}>
          <h2 className={styles.authTitle}>다시 오셨네요!</h2>

          <input
            type="email"
            className={styles.authInput}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
            aria-label="이메일"
          />

          <input
            type="password"
            className={styles.authInput}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            aria-label="비밀번호"
          />
        </form>

        <div className={styles.authFooter}>
          {}

          {error && <p className={styles.errorMessage}>{error}</p>}

          <button
            type="submit"
            className={styles.authButton}
            onClick={handleLogin}
          >
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
