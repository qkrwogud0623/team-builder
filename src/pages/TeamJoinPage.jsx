/**
 * @file TeamJoinPage.jsx
 * @description
 * 사용자가 초대 코드를 입력하여 기존 팀에 합류하는 페이지 컴포넌트입니다.
 * - 사용자의 프로필 정보를 가져와 이미 팀에 속해있는지 확인합니다.
 * - 유효한 초대 코드인지 Firestore에서 검증합니다.
 * - 성공 시, 사용자를 팀 멤버로 추가하고 사용자 정보에 팀 ID를 업데이트합니다.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

// [리팩토링] 이 컴포넌트만을 위한 전용 CSS 파일을 불러옵니다.
import styles from './TeamJoinPage.module.css';

function TeamJoinPage() {
  // --- 상태 관리 ---
  const [inviteCode, setInviteCode] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // 초기 프로필 로딩 상태
  const [isSubmitting, setIsSubmitting] = useState(false); // 팀 참가 요청 처리 중 상태
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
  const handleJoinTeam = async (e) => {
    e.preventDefault();
    setError('');

    // --- 유효성 검사 ---
    if (isLoading || !userProfile) {
      setError('프로필 정보를 불러오는 중입니다.');
      return;
    }
    if (!inviteCode.trim()) {
      setError('초대 코드를 입력해주세요.');
      return;
    }
    if (userProfile.teamId) {
      setError('이미 다른 팀에 소속되어 있습니다.');
      return;
    }

    setIsSubmitting(true);
    const user = auth.currentUser;

    try {
      // 1. 입력된 초대 코드로 팀 찾기
      const teamsRef = collection(db, "teams");
      const q = query(teamsRef, where("inviteCode", "==", inviteCode.trim().toUpperCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("유효하지 않은 초대 코드입니다.");
      }

      const teamDoc = querySnapshot.docs[0];
      const teamId = teamDoc.id;
      const teamName = teamDoc.data().teamName;

      // 2. 해당 팀의 'members' 서브컬렉션에 현재 사용자 추가
      const memberDocRef = doc(db, "teams", teamId, "members", user.uid);
      await setDoc(memberDocRef, {
        realName: userProfile.realName,
        position: userProfile.preferredPosition || 'CM', // 선호 포지션 없으면 'CM'
        role: 'member'
      });

      // 3. 사용자의 'users' 문서에 팀 정보(teamId, teamRole) 업데이트
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        teamId: teamId,
        teamRole: 'member'
      });
      
      // 4. 성공 시, 해당 팀 페이지로 이동
      // alert() 대신, 성공 페이지나 모달을 띄워주는 것이 더 좋은 UX입니다.
      // 여기서는 우선 navigate로 바로 이동합니다.
      navigate(`/team/${teamId}`);

    } catch (err) {
      console.error("Team Join Error:", err);
      setError(err.message || "팀 참가 중 오류가 발생했습니다.");
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
        <form onSubmit={handleJoinTeam}>
          <h2 className={styles.title}>팀에 참가하기</h2>
          <input 
            className={styles.input}
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value)}
            placeholder="초대 코드를 입력하세요" 
            aria-label="초대 코드"
          />
        </form>
      </div>
      <div className={styles.footer}>
        {error && <p className={styles.errorMessage}>{error}</p>}
        <button 
          className={styles.button} 
          onClick={handleJoinTeam}
          disabled={isSubmitting}
        >
          {isSubmitting ? '참가하는 중...' : '참가하기'}
        </button>
      </div>
    </div>
  );
}

export default TeamJoinPage;
