/**
 * @file TeamCreatePage.jsx
 * @description
 * 사용자가 새로운 팀을 생성하는 페이지 컴포넌트입니다.
 * - 팀 이름의 중복 여부를 확인합니다.
 * - Firestore에 새로운 팀 문서를 생성하고, 고유한 초대 코드를 발급합니다.
 * - 팀 생성자를 'captain' 역할로 하여 멤버 서브컬렉션에 추가합니다.
 * - 사용자의 프로필 정보에 생성된 팀 ID를 업데이트합니다.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, addDoc, doc, setDoc, updateDoc, getDoc, query, where, getDocs, limit, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

// [리팩토링] 이 컴포넌트만을 위한 전용 CSS 파일을 불러옵니다.
import styles from './TeamCreatePage.module.css';

function TeamCreatePage() {
  // --- 상태 관리 ---
  const [teamName, setTeamName] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // --- 데이터 로딩 ---
  useEffect(() => {
    // 컴포넌트 마운트 시, 현재 로그인된 사용자의 프로필 정보를 가져옵니다.
    const fetchUserProfile = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          setUserProfile(docSnap.data());
        }
      }
      setIsLoading(false);
    };
    fetchUserProfile();
  }, []);

  // --- 이벤트 핸들러 ---
  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setError('');

    // --- 유효성 검사 ---
    const trimmedTeamName = teamName.trim();
    if (isLoading || !userProfile) {
      setError('프로필 정보를 불러오는 중입니다.');
      return;
    }
    if (!trimmedTeamName) {
      setError('팀 이름을 입력해주세요.');
      return;
    }
    if (userProfile.teamId) {
      setError('이미 다른 팀에 소속되어 있습니다.');
      return;
    }

    setIsSubmitting(true);

    try {
      const user = auth.currentUser;
      const teamsRef = collection(db, "teams");

      // 1. 팀 이름 중복 확인 (대소문자 무시)
      const normalizedTeamName = trimmedTeamName.toLowerCase();
      const q = query(teamsRef, where("teamNameLower", "==", normalizedTeamName), limit(1));
      const duplicateSnapshot = await getDocs(q);

      if (!duplicateSnapshot.empty) {
        throw new Error('이미 존재하는 팀 이름입니다.');
      }

      // 2. 고유한 초대 코드 생성
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // 3. 'teams' 컬렉션에 새로운 팀 문서 생성
      const teamDocRef = await addDoc(teamsRef, {
        teamName: trimmedTeamName,
        teamNameLower: normalizedTeamName, // 중복 체크를 위한 필드
        captainId: user.uid,
        inviteCode: inviteCode,
        createdAt: serverTimestamp(),
      });
      const newTeamId = teamDocRef.id;

      // 4. 생성된 팀의 'members' 서브컬렉션에 팀장(본인) 정보 추가
      const memberDocRef = doc(db, "teams", newTeamId, "members", user.uid);
      await setDoc(memberDocRef, {
        realName: userProfile.realName || '이름없음',
        position: userProfile.preferredPosition || 'CM',
        role: 'captain',
        joinedAt: serverTimestamp(),
      });

      // 5. 사용자의 'users' 문서에 팀 정보 업데이트
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        teamId: newTeamId,
        teamRole: 'captain'
      });
      
      // 6. 성공 시, 생성된 팀 페이지로 이동
      navigate(`/team/${newTeamId}`);

    } catch (err) {
      console.error("Team Creation Error:", err);
      setError(err.message || "팀 생성 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 렌더링 ---
  if (isLoading) {
    return <div className={styles.loadingContainer}>프로필 정보를 확인 중...</div>;
  }

  return (
    <div className={styles.pageContainer}>
      <header className={styles.pageHeader}>
        <Link to="/" className={styles.backButton}>←</Link>
      </header>
      <div className={styles.content}>
        <form onSubmit={handleCreateTeam}>
          <h2 className={styles.title}>새로운 팀 만들기</h2>
          <input
            className={styles.input}
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            placeholder="팀 이름을 입력하세요"
            aria-label="팀 이름"
            maxLength={40}
          />
        </form>
      </div>
      <div className={styles.footer}>
        {error && <p className={styles.errorMessage}>{error}</p>}
        <button
          type="submit"
          className={styles.button}
          onClick={handleCreateTeam}
          disabled={isSubmitting}
        >
          {isSubmitting ? '생성 중...' : '팀 생성하기'}
        </button>
      </div>
    </div>
  );
}

export default TeamCreatePage;
