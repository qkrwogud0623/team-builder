/**
 * @file App.jsx
 * @description 애플리케이션의 최상위 라우팅 및 인증 상태 관리 컴포넌트
 * [리팩토링]
 * - 복잡한 삼항 연산자 라우팅 구조를 명확한 조건부 렌더링으로 변경
 * - 로딩 상태 변수명 구체화 (loading -> isAuthLoading)
 * - useEffect 로직 분리 및 최적화
 * - 주석 추가 및 파일명 변경사항 적용
 */
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';

// 전역 스타일
import './styles/global.css';

// 페이지 컴포넌트들
import LoginPage from './pages/LoginPage.jsx';
import SignUpPage from './pages/SignUpPage.jsx';
import SurveyPage from './pages/SurveyPage.jsx';
import HomePage from './pages/HomePage.jsx'; // MainScreen -> HomePage
import TeamCreatePage from './pages/TeamCreatePage.jsx'; // CreateTeamPage -> TeamCreatePage
import TeamJoinPage from './pages/TeamJoinPage.jsx'; // JoinTeamPage -> TeamJoinPage
import TeamPage from './pages/TeamPage.jsx';

function App() {
  // --- 상태 관리 ---
  const [user, setUser] = useState(null); // Firebase 인증 유저 객체
  const [profile, setProfile] = useState(null); // Firestore에 저장된 유저 프로필
  const [isAuthLoading, setIsAuthLoading] = useState(true); // 인증 상태 확인 로딩

  // --- 생명주기 훅 ---

  // 1. Firebase 인증 상태 변화를 감지합니다.
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      // 유저가 없으면 프로필을 조회할 필요가 없으므로 로딩을 바로 종료합니다.
      if (!currentUser) {
        setIsAuthLoading(false);
      }
    });
    // 컴포넌트 언마운트 시 구독을 해제하여 메모리 누수를 방지합니다.
    return () => unsubscribeAuth();
  }, []);

  // 2. 로그인된 유저가 있을 경우, Firestore에서 프로필 정보를 실시간으로 감지합니다.
  useEffect(() => {
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setProfile(docSnap.data());
        } else {
          // 문서가 없는 경우 (예: 계정 삭제 후)
          setProfile(null);
        }
        setIsAuthLoading(false); // 프로필 정보까지 확인 후 로딩 종료
      }, (error) => {
        console.error("프로필 구독 에러:", error);
        setIsAuthLoading(false);
      });
      return () => unsubscribeProfile();
    } else {
      // 유저가 로그아웃하면 프로필 정보를 null로 초기화합니다.
      setProfile(null);
    }
  }, [user]);

  // --- 렌더링 로직 ---

  // 인증 및 프로필 로딩 중일 때 로딩 화면을 표시합니다.
  if (isAuthLoading) {
    return <div className="loading-container">로딩 중...</div>;
  }

  // 사용자의 상태에 따라 3가지 다른 라우트 그룹을 렌더링합니다.
  const renderRoutes = () => {
    // 1. 비로그인 상태: 로그인, 회원가입 페이지만 접근 가능
    if (!user) {
      return (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      );
    }

    // 2. 로그인 O, 설문조사 미완료 상태: 설문조사 페이지만 접근 가능
    if (!profile?.surveyCompleted) {
      return (
        <Routes>
          <Route path="/survey" element={<SurveyPage userProfile={profile} />} />
          <Route path="*" element={<Navigate to="/survey" />} />
        </Routes>
      );
    }

    // 3. 로그인 O, 설문조사 완료 상태: 모든 핵심 기능 페이지 접근 가능
    return (
      <Routes>
        <Route path="/" element={<HomePage userProfile={profile} />} />
        <Route path="/create-team" element={<TeamCreatePage />} />
        <Route path="/join-team" element={<TeamJoinPage />} />
        <Route path="/team/:teamId" element={<TeamPage userProfile={profile} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    );
  };

  return (
    <BrowserRouter>
      {renderRoutes()}
    </BrowserRouter>
  );
}

export default App;
