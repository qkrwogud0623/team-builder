/* eslint-disable no-undef */
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Container, Typography, Box, TextField, Button, Paper, Grid,
  createTheme, ThemeProvider, CssBaseline, IconButton, Tabs, Tab,
  Checkbox, FormControlLabel, Select, MenuItem, FormControl, InputLabel,
  List, ListItem, ListItemText, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  CircularProgress, Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import LogoutIcon from '@mui/icons-material/Logout';
import DeleteIcon from '@mui/icons-material/Delete';
import CancelIcon from '@mui/icons-material/Cancel';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import UndoIcon from '@mui/icons-material/Undo'; // 건의 반려 아이콘

// Firebase SDK import
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { 
  getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, arrayUnion, query, orderBy, where, getDocs, setDoc, getDoc, deleteDoc, arrayRemove
} from "firebase/firestore";

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Firestore collection references
const songsCollectionRef = collection(db, "songs");
const usersCollectionRef = collection(db, "users");
const teamSessionDocRef = doc(db, "session", "main");

const ADMIN_USERS = ['김연진', '송하늘', '박재형'];
const VOTE_LIMIT = 3;

const SESSIONS = {
  vocal: "보컬", guitar: "기타", bass: "베이스", drum: "드럼", keyboard: "키보드"
};
const SESSION_KEYS = Object.keys(SESSIONS);

const darkTheme = createTheme({
  palette: {
    mode: 'dark', primary: { main: '#90caf9' }, secondary: { main: '#f48fb1' }, success: { main: '#81c784' },
  },
});

const EditableTeamCard = ({ team, teamIndex, participants, onTeamChange, onPinToggle, isAdmin }) => {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%', border: team.isPinned ? '2px solid #81c784' : '1px solid rgba(255, 255, 255, 0.23)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" color={team.isPinned ? 'success.main' : 'inherit'}>팀 {teamIndex + 1}</Typography>
        {isAdmin && (
          <IconButton onClick={() => onPinToggle(team.id)} color={team.isPinned ? 'success' : 'default'}>
            {team.isPinned ? <PushPinIcon /> : <PushPinOutlinedIcon />}
          </IconButton>
        )}
      </Box>
      {SESSION_KEYS.map(key => {
        const isMultiSlot = key === 'guitar' || key === 'keyboard';
        const numSlots = isMultiSlot ? 2 : 1;
        return (
          <Box key={key} sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>{SESSIONS[key]}</Typography>
            {Array.from({ length: numSlots }).map((_, slotIndex) => {
              if (isMultiSlot && slotIndex === 1 && !team.members[key][0]) return null;
              const assignedMember = team.members[key][slotIndex] || '';
              return (
                <FormControl key={slotIndex} fullWidth size="small" sx={{ mb: 1 }}>
                  <InputLabel>{SESSIONS[key]} {isMultiSlot ? slotIndex + 1 : ''}</InputLabel>
                  <Select value={assignedMember} label={`${SESSIONS[key]} ${isMultiSlot ? slotIndex + 1 : ''}`} onChange={(e) => onTeamChange(team.id, key, slotIndex, e.target.value)} disabled={!isAdmin}>
                    <MenuItem value=""><em>- 비우기 -</em></MenuItem>
                    {participants.filter(p => p.name && p.sessions.includes(key)).filter(p => !(isMultiSlot && p.name === team.members[key][1 - slotIndex])).map(p => <MenuItem key={`${p.id}-${slotIndex}`} value={p.name}>{p.name}</MenuItem>)}
                  </Select>
                </FormControl>
              );
            })}
          </Box>
        );
      })}
    </Paper>
  );
};

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userNameInput, setUserNameInput] = useState('');
  const [currentTab, setCurrentTab] = useState(0);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [teamCount, setTeamCount] = useState(2);
  const [generatedTeams, setGeneratedTeams] = useState(null);
  const [songs, setSongs] = useState([]);
  const [newSongTitle, setNewSongTitle] = useState('');
  const [openVoteDialog, setOpenVoteDialog] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState(null);

  useEffect(() => {
    const authAndLoad = async () => {
      try {
        await signInAnonymously(auth);
        const savedUser = localStorage.getItem('ensemble_user');
        if (savedUser) setCurrentUser(JSON.parse(savedUser));
        setIsAuthReady(true);
      } catch (error) { console.error("Authentication failed:", error); } 
      finally { setLoading(false); }
    };
    authAndLoad();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    const usersUnsubscribe = onSnapshot(usersCollectionRef, (snapshot) => setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const songsQuery = query(songsCollectionRef, orderBy('deletionSuggested', 'desc'), orderBy('createdAt', 'desc'));
    const songsUnsubscribe = onSnapshot(songsQuery, (snapshot) => setSongs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const teamSessionUnsubscribe = onSnapshot(teamSessionDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setGeneratedTeams(data.teams || null);
        setTeamCount(data.teamCount || 2);
      }
    });
    return () => { usersUnsubscribe(); songsUnsubscribe(); teamSessionUnsubscribe(); };
  }, [isAuthReady]);

  const userVoteCount = useMemo(() => {
    if (!currentUser) return 0;
    return songs.reduce((count, song) => count + (song.voters.includes(currentUser.name) ? 1 : 0), 0);
  }, [songs, currentUser]);

  const handleLogin = async () => {
    const name = userNameInput.trim();
    if (!name) return;
    const role = ADMIN_USERS.includes(name) ? 'admin' : 'user';
    const userDocRef = doc(db, "users", name);
    const docSnap = await getDoc(userDocRef);
    let userData = docSnap.exists() ? { ...docSnap.data(), role } : { name, sessions: [], role };
    await setDoc(userDocRef, userData, { merge: true });
    setCurrentUser(userData);
    localStorage.setItem('ensemble_user', JSON.stringify(userData));
  };
  
  const handleLogout = () => {
    localStorage.removeItem('ensemble_user');
    setCurrentUser(null);
  };

  const handleSessionChange = async (sessionKey) => {
    const newSessions = currentUser.sessions.includes(sessionKey) ? currentUser.sessions.filter(s => s !== sessionKey) : [...currentUser.sessions, sessionKey];
    const updatedUser = { ...currentUser, sessions: newSessions };
    setCurrentUser(updatedUser);
    localStorage.setItem('ensemble_user', JSON.stringify(updatedUser));
    await updateDoc(doc(db, "users", currentUser.name), { sessions: newSessions });
  };

  const handleTabChange = (event, newValue) => setCurrentTab(newValue);

  const handleGenerateTeams = async () => {
    if (allUsers.length === 0) { alert("참여자가 없습니다."); return; }
    const pinnedTeams = generatedTeams ? generatedTeams.filter(t => t.isPinned) : [];
    const unpinnedTeamCount = teamCount - pinnedTeams.length;
    if (unpinnedTeamCount < 0) { alert("총 팀 수는 고정된 팀 수보다 적을 수 없습니다."); return; }
    const gigCounts = allUsers.reduce((acc, p) => ({ ...acc, [p.name]: 0 }), {});
    pinnedTeams.forEach(team => { Object.values(team.members).flat().forEach(name => { if (gigCounts[name] !== undefined) gigCounts[name]++; }); });
    let autoGeneratedTeams = Array.from({ length: unpinnedTeamCount }, (_, i) => ({ id: `team-${Date.now()}-${i}`, members: SESSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: [] }), {}), isPinned: false }));
    const findBestCandidate = (sessionKey, excludedNames = []) => {
      const candidates = allUsers.filter(p => p.sessions.includes(sessionKey) && !excludedNames.includes(p.name));
      if (candidates.length === 0) return null;
      const minGigs = Math.min(...candidates.map(c => gigCounts[c.name]));
      const bestCandidates = candidates.filter(c => gigCounts[c.name] === minGigs);
      return bestCandidates[Math.floor(Math.random() * bestCandidates.length)];
    };
    SESSION_KEYS.forEach(key => { for (const team of autoGeneratedTeams) { const candidate = findBestCandidate(key); if (candidate) { team.members[key][0] = candidate.name; gigCounts[candidate.name]++; } } });
    ['guitar', 'keyboard'].forEach(key => { for (const team of autoGeneratedTeams) { const personInFirstSlot = team.members[key][0]; const candidate = findBestCandidate(key, [personInFirstSlot]); if (candidate) { team.members[key][1] = candidate.name; gigCounts[candidate.name]++; } } });
    await setDoc(teamSessionDocRef, { teams: [...pinnedTeams, ...autoGeneratedTeams], teamCount: teamCount });
  };

  const handleTeamChange = async (teamId, sessionKey, slotIndex, newName) => {
    const updatedTeams = generatedTeams.map(team => {
      if (team.id === teamId) {
        const newMembers = [...team.members[sessionKey]]; newMembers[slotIndex] = newName;
        const cleanedMembers = newMembers.filter(name => name);
        return { ...team, members: { ...team.members, [sessionKey]: cleanedMembers } };
      }
      return team;
    });
    await updateDoc(teamSessionDocRef, { teams: updatedTeams });
  };

  const handlePinToggle = async (teamId) => {
    const updatedTeams = generatedTeams.map(team => team.id === teamId ? { ...team, isPinned: !team.isPinned } : team);
    await updateDoc(teamSessionDocRef, { teams: updatedTeams });
  };

  const handleAddSong = async () => {
    const trimmedTitle = newSongTitle.trim();
    if (trimmedTitle === '') return;
    const q = query(songsCollectionRef, where("title_lowercase", "==", trimmedTitle.toLowerCase()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) { alert('이미 추가된 곡입니다.'); return; }
    await addDoc(songsCollectionRef, { 
      title: trimmedTitle, 
      title_lowercase: trimmedTitle.toLowerCase(), 
      voters: [], 
      createdAt: new Date(),
      deletionSuggested: false
    });
    setNewSongTitle('');
  };

  const handleDeleteSong = async (songId, songTitle) => {
    if (window.confirm(`정말로 "${songTitle}" 곡을 삭제하시겠습니까?`)) {
      await deleteDoc(doc(db, "songs", songId));
    }
  };

  const handleSuggestDeletion = async (songId) => {
    const songDocRef = doc(db, "songs", songId);
    await updateDoc(songDocRef, { deletionSuggested: true });
  };

  // --- ▼▼▼▼▼ 삭제 건의 반려 핸들러 추가 ▼▼▼▼▼ ---
  const handleRejectDeletion = async (songId) => {
    const songDocRef = doc(db, "songs", songId);
    await updateDoc(songDocRef, { deletionSuggested: false });
  };
  // --- ▲▲▲▲▲ 삭제 건의 반려 핸들러 추가 ▲▲▲▲▲ ---

  const handleVote = async () => {
    if (!currentUser || !selectedSongId) return;
    const songDocRef = doc(db, "songs", selectedSongId);
    await updateDoc(songDocRef, { voters: arrayUnion(currentUser.name) });
    setOpenVoteDialog(false); setSelectedSongId(null);
  };
  
  const handleCancelVote = async (songId) => {
    if (!currentUser) return;
    const songDocRef = doc(db, "songs", songId);
    await updateDoc(songDocRef, { voters: arrayRemove(currentUser.name) });
  };

  const handleClickOpenDialog = (songId) => { setSelectedSongId(songId); setOpenVoteDialog(true); };
  const handleCloseDialog = () => { setOpenVoteDialog(false); setSelectedSongId(null); };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#121212' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (!currentUser) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Container component="main" maxWidth="xs" sx={{ mt: 8 }}>
          <Paper elevation={6} sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography component="h1" variant="h5">로그인</Typography>
            <Box sx={{ mt: 1 }}>
              <TextField margin="normal" required fullWidth autoFocus label="이름" name="name" value={userNameInput} onChange={(e) => setUserNameInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleLogin()} />
              <Button fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} onClick={handleLogin}>입장하기</Button>
            </Box>
          </Paper>
        </Container>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Container maxWidth="lg" sx={{ my: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1">마테시스 합주 앱</Typography>
          <Box>
            {currentUser.role === 'admin' && <Chip label="Admin" color="success" size="small" sx={{mr: 2}} />}
            <Button startIcon={<LogoutIcon />} onClick={handleLogout}>로그아웃</Button>
          </Box>
        </Box>
        
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6">{currentUser.name}님, 안녕하세요!</Typography>
          <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>가능한 세션을 선택해주세요.</Typography>
          {SESSION_KEYS.map(key => (
            <FormControlLabel key={key} control={<Checkbox checked={currentUser.sessions.includes(key)} onChange={() => handleSessionChange(key)} />} label={SESSIONS[key]} />
          ))}
        </Paper>

        <Paper elevation={3}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={currentTab} onChange={handleTabChange} centered>
              <Tab label="합주 팀 빌더" />
              <Tab label="합주곡 투표" />
            </Tabs>
          </Box>
          
          {currentTab === 0 && (
            <Box p={3}>
              <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>참여자 목록 ({allUsers.length}명)</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {allUsers.map(user => <Chip key={user.id} label={user.name} color={user.role === 'admin' ? 'success' : 'default'} />)}
                </Box>
              </Paper>

              {currentUser.role === 'admin' && (
                <Paper elevation={3} sx={{ p: 3, mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <TextField label="총 팀 수" type="number" value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))} size="small" InputProps={{ inputProps: { min: 1 } }} />
                  <Button variant="contained" color="secondary" size="large" onClick={handleGenerateTeams}>최적의 팀 생성하기</Button>
                </Paper>
              )}

              {generatedTeams ? (
                <Paper elevation={3} sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>팀 구성 결과</Typography>
                  <Grid container spacing={2}>
                    {generatedTeams.map((team, index) => (
                      <Grid item xs={12} sm={6} md={4} key={team.id}>
                        <EditableTeamCard team={team} teamIndex={index} participants={allUsers} onTeamChange={handleTeamChange} onPinToggle={handlePinToggle} isAdmin={currentUser.role === 'admin'} />
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              ) : (
                <Typography sx={{textAlign: 'center', p: 3}}>관리자가 아직 팀을 생성하지 않았습니다.</Typography>
              )}
            </Box>
          )}

          {currentTab === 1 && (
            <Box p={3}>
              <Paper elevation={3} sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField fullWidth label="새 합주곡 추가" size="small" value={newSongTitle} onChange={(e) => setNewSongTitle(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddSong()} />
                  <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddSong} disabled={!newSongTitle.trim()}>추가</Button>
                </Box>
              </Paper>
              <Paper elevation={3} sx={{ p: 2 }}>
                <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <Typography variant="h6" gutterBottom>투표 현황</Typography>
                  <Chip label={`내 투표 수: ${userVoteCount} / ${VOTE_LIMIT}`} color={userVoteCount >= VOTE_LIMIT ? "error" : "primary"} />
                </Box>
                <List>
                  {songs.map((song) => {
                    const hasVoted = song.voters.includes(currentUser.name);
                    return (
                      <ListItem 
                        key={song.id} 
                        divider 
                        secondaryAction={
                          <Box sx={{display: 'flex', alignItems: 'center'}}>
                            {hasVoted ? (
                              <Button variant="contained" color="error" size="small" startIcon={<CancelIcon />} onClick={() => handleCancelVote(song.id)}>투표 취소</Button>
                            ) : (
                              <Button variant="outlined" size="small" startIcon={<HowToVoteIcon />} onClick={() => handleClickOpenDialog(song.id)} disabled={userVoteCount >= VOTE_LIMIT}>투표하기</Button>
                            )}
                            
                            {/* --- ▼▼▼▼▼ 삭제/건의/반려 버튼 UI 수정 ▼▼▼▼▼ --- */}
                            {currentUser.role === 'admin' ? (
                              song.deletionSuggested ? (
                                <>
                                  <Tooltip title="건의 반려">
                                    <IconButton onClick={() => handleRejectDeletion(song.id)} sx={{ml: 1}} color="success">
                                      <UndoIcon />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="영구 삭제">
                                    <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteSong(song.id, song.title)} color="error">
                                      <DeleteIcon />
                                    </IconButton>
                                  </Tooltip>
                                </>
                              ) : (
                                <Tooltip title="삭제 건의">
                                  <IconButton onClick={() => handleSuggestDeletion(song.id)} sx={{ml: 1}}>
                                    <ReportProblemIcon />
                                  </IconButton>
                                </Tooltip>
                              )
                            ) : (
                              !song.deletionSuggested && (
                                <Tooltip title="삭제 건의">
                                  <IconButton onClick={() => handleSuggestDeletion(song.id)} sx={{ml: 1}}>
                                    <ReportProblemIcon />
                                  </IconButton>
                                </Tooltip>
                              )
                            )}
                            {/* --- ▲▲▲▲▲ 삭제/건의/반려 버튼 UI 수정 ▲▲▲▲▲ --- */}
                          </Box>
                        }
                      >
                        <ListItemText 
                          primary={<Typography variant="h6" color={song.deletionSuggested ? 'error' : 'inherit'}>{song.title}</Typography>} 
                          secondary={
                            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                              {song.voters.length > 0 ? song.voters.map((voter, index) => (<Chip key={index} label={voter} size="small" color={voter === currentUser.name ? "primary" : "secondary"} />)) : <Typography variant="body2" color="text.secondary">아직 투표한 사람이 없습니다.</Typography>}
                            </Box>
                          } 
                        />
                      </ListItem>
                    );
                  })}
                </List>
              </Paper>
            </Box>
          )}
        </Paper>

        <Dialog open={openVoteDialog} onClose={handleCloseDialog}>
          <DialogTitle>투표하기</DialogTitle>
          <DialogContent>
            <Typography>"{currentUser.name}" 이름으로 투표합니다.</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>취소</Button>
            <Button onClick={handleVote}>확인</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </ThemeProvider>
  );
}

export default App;
