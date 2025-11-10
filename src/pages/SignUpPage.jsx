/**
 * 회원가입 페이지로 사용자 계정과 프로필 기본 정보를 생성한다.
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import styles from "./LoginPage.module.css";

// 신규 가입 폼을 렌더링하고 Firebase 인증 및 Firestore 초기화를 수행한다.
function SignUpPage() {
  const [realName, setRealName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");

  // 입력값 검증 후 회원가입을 실행한다.
  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");

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
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        realName: realName.trim(),
        email: email,
        surveyCompleted: false,
      });
    } catch (err) {
      console.error("Sign Up Error:", err);
      if (err.code === "auth/email-already-in-use") {
        setError("이미 사용 중인 이메일입니다.");
      } else if (err.code === "auth/invalid-email") {
        setError("유효하지 않은 이메일 형식입니다.");
      } else {
        setError("회원가입 중 오류가 발생했습니다. 다시 시도해주세요.");
      }
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authContent}>
        <form className={styles.formWrapper} onSubmit={handleSignUp}>
          <h2 className={styles.authTitle}>처음이신가요?</h2>
          <input
            className={styles.authInput}
            value={realName}
            onChange={(e) => setRealName(e.target.value)}
            placeholder="실명"
            aria-label="실명"
          />
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
            placeholder="비밀번호 (6자리 이상)"
            aria-label="비밀번호"
          />
          <input
            type="password"
            className={styles.authInput}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="비밀번호 확인"
            aria-label="비밀번호 확인"
          />
        </form>
        <div className={styles.authFooter}>
          {error && <p className={styles.errorMessage}>{error}</p>}
          <button
            type="submit"
            className={styles.authButton}
            onClick={handleSignUp}
          >
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
