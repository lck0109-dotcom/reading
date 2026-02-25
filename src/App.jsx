import React, { useState, useEffect } from 'react';
import { 
  Users, Trash2, Award, ShoppingCart, RotateCcw, 
  Plus, Trophy, X, History, UserPlus, Star, CheckSquare, Square, Loader2
} from 'lucide-react';

// --- Firebase 모듈 임포트 ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

export default function App() {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // 데이터 로딩 상태
  
  // Firebase 연동 상태
  const [db, setDb] = useState(null);
  const [user, setUser] = useState(null);
  const [collectionPath, setCollectionPath] = useState('');

  const [activeTab, setActiveTab] = useState('1'); 
  const [modalType, setModalType] = useState(null); 
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedTrashIds, setSelectedTrashIds] = useState([]); 

  const [newStudent, setNewStudent] = useState({ name: '', grade: '1' });
  const [grantData, setGrantData] = useState({ points: 1, reason: '독서 기록 완료' });
  const [shopData, setShopData] = useState({ itemName: '', cost: 1 });
  
  const [sortType, setSortType] = useState('name'); 
  const [dialog, setDialog] = useState({ isOpen: false, type: 'alert', message: '', onConfirm: null });

  const showAlert = (message) => setDialog({ isOpen: true, type: 'alert', message, onConfirm: null });
  const showConfirm = (message, onConfirm) => setDialog({ isOpen: true, type: 'confirm', message, onConfirm });

  // --------------------------------------------------------
  // ☁️ [중요] Firebase 초기화 및 연동 (클라우드 동기화)
  // --------------------------------------------------------
  useEffect(() => {
    // 💡 아래 설정값을 본인의 파이어베이스 정보로 교체하세요! (Netlify 배포 시 필수)
    const myFirebaseConfig = {
      apiKey: "AIzaSyAyGOSP6rEDiK1HWbXElwoUUJWR_qxOrno",
      authDomain: "sungduk-reading.firebaseapp.com",
      projectId: "sungduk-reading",
      messagingSenderId: "462909134372",
      appId: "1:462909134372:web:274b29570c98fbeb336ab1",
      measurementId: "G-LXVDP3S0X3"
    };

    // (미리보기 환경과 실제 배포 환경을 모두 지원하기 위한 코드입니다)
    const firebaseConfig = typeof __firebase_config !== 'undefined' 
      ? JSON.parse(__firebase_config) 
      : myFirebaseConfig;

    const app = initializeApp(firebaseConfig);
    const authInstance = getAuth(app);
    const dbInstance = getFirestore(app);
    setDb(dbInstance);

    // 경로 설정 (모든 기기에서 같은 데이터를 보기 위해 public 경로 사용)
    const path = typeof __app_id !== 'undefined' 
      ? `artifacts/${__app_id}/public/data/students_data` 
      : 'class_students_data'; // Netlify 배포 시 Firestore에 생성될 컬렉션 이름
    setCollectionPath(path);

    // 인증 처리
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(authInstance, __initial_auth_token);
        } else {
          await signInAnonymously(authInstance);
        }
      } catch (error) {
        console.error("인증 에러:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(authInstance, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  // --------------------------------------------------------
  // ☁️ 데이터 실시간 불러오기 (Real-time Sync)
  // --------------------------------------------------------
  useEffect(() => {
    if (!db || !user || !collectionPath) return;

    const q = collection(db, collectionPath);
    
    // onSnapshot을 사용하면 기기 A에서 수정 시 기기 B에서도 즉시 새로고침 없이 바뀝니다!
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach((doc) => {
        data.push(doc.data());
      });
      setStudents(data);
      setIsLoading(false);
    }, (error) => {
      console.error("데이터 불러오기 에러:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, user, collectionPath]);

  // --- DB 업데이트 헬퍼 함수 ---
  const saveStudentToDB = async (studentObj) => {
    if (!db || !collectionPath) return;
    try {
      const docRef = doc(db, collectionPath, studentObj.id);
      await setDoc(docRef, studentObj);
    } catch (error) {
      console.error("저장 에러:", error);
    }
  };

  const deleteStudentFromDB = async (studentId) => {
    if (!db || !collectionPath) return;
    try {
      const docRef = doc(db, collectionPath, studentId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("삭제 에러:", error);
    }
  };


  // 탭 변경 시 휴지통 선택 초기화
  useEffect(() => {
    if (activeTab !== 'trash') setSelectedTrashIds([]);
  }, [activeTab]);


  // --------------------------------------------------------
  // 1. 학생 관리 기능 (DB 연동)
  // --------------------------------------------------------
  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newStudent.name.trim()) return;
    
    const student = {
      id: Date.now().toString(),
      name: newStudent.name,
      grade: parseInt(newStudent.grade),
      points: 0,
      isDeleted: false,
      history: []
    };
    
    await saveStudentToDB(student);
    setNewStudent({ name: '', grade: activeTab >= '1' && activeTab <= '6' ? activeTab : '1' });
    setModalType(null);
  };

  const handleDeleteStudent = (id) => {
    showConfirm('학생을 휴지통으로 이동하시겠습니까?', async () => {
      const student = students.find(s => s.id === id);
      if(student) await saveStudentToDB({ ...student, isDeleted: true });
    });
  };

  // 단일 복구
  const handleRestoreStudent = async (id) => {
    const student = students.find(s => s.id === id);
    if(student) {
      await saveStudentToDB({ ...student, isDeleted: false });
      setSelectedTrashIds(prev => prev.filter(trashId => trashId !== id));
    }
  };

  // 단일 영구 삭제
  const handlePermanentDelete = (id) => {
    showConfirm('영구 삭제하면 복구할 수 없습니다. 삭제하시겠습니까?', async () => {
      await deleteStudentFromDB(id);
      setSelectedTrashIds(prev => prev.filter(trashId => trashId !== id));
    });
  };

  // --------------------------------------------------------
  // 1-2. 휴지통 일괄 관리 기능 (DB 연동)
  // --------------------------------------------------------
  const deletedStudents = students.filter(s => s.isDeleted);

  const handleToggleTrashSelect = (id) => {
    setSelectedTrashIds(prev => 
      prev.includes(id) ? prev.filter(trashId => trashId !== id) : [...prev, id]
    );
  };

  const handleSelectAllTrash = () => {
    if (selectedTrashIds.length === deletedStudents.length) {
      setSelectedTrashIds([]); 
    } else {
      setSelectedTrashIds(deletedStudents.map(s => s.id)); 
    }
  };

  const handleBatchRestore = async () => {
    if (selectedTrashIds.length === 0) return;
    for (const id of selectedTrashIds) {
      const student = students.find(s => s.id === id);
      if (student) await saveStudentToDB({ ...student, isDeleted: false });
    }
    setSelectedTrashIds([]);
  };

  const handleBatchDelete = () => {
    if (selectedTrashIds.length === 0) return;
    showConfirm(`선택한 ${selectedTrashIds.length}명의 학생을 영구 삭제하시겠습니까?`, async () => {
      for (const id of selectedTrashIds) {
        await deleteStudentFromDB(id);
      }
      setSelectedTrashIds([]);
    });
  };

  // --------------------------------------------------------
  // 2. 점수(지혜) 부여 기능 (DB 연동)
  // --------------------------------------------------------
  const handleGrantWisdom = async (e) => {
    e.preventDefault();
    const pointToAdd = parseInt(grantData.points);
    if (isNaN(pointToAdd) || pointToAdd <= 0) return showAlert('올바른 점수를 입력하세요.');

    const reasonText = grantData.reason.trim() || '독서 기록 완료';

    const historyItem = {
      id: Date.now().toString(),
      type: 'add',
      amount: pointToAdd,
      reason: reasonText,
      date: new Date().toLocaleString(),
      timestamp: Date.now()
    };

    const targetStudent = students.find(s => s.id === selectedStudent.id);
    if (targetStudent) {
      const updatedStudent = { 
        ...targetStudent, 
        points: targetStudent.points + pointToAdd, 
        history: [historyItem, ...targetStudent.history] 
      };
      await saveStudentToDB(updatedStudent);
    }
    setModalType(null);
  };

  // --------------------------------------------------------
  // 3. 물품 구입 (점수 차감) 기능 (DB 연동)
  // --------------------------------------------------------
  const handleUseWisdom = async (e) => {
    e.preventDefault();
    const cost = parseInt(shopData.cost);
    if (!shopData.itemName.trim()) return showAlert('어떤 선물을 교환할지 입력해주세요!');
    if (isNaN(cost) || cost <= 0) return showAlert('올바른 차감 점수를 입력하세요.');
    if (selectedStudent.points < cost) return showAlert(`보유한 지혜가 부족해요!\n(현재: ${selectedStudent.points}개 / 필요: ${cost}개)`);

    const historyItem = {
      id: Date.now().toString(),
      type: 'use',
      amount: cost,
      reason: `물품 구입: ${shopData.itemName}`,
      date: new Date().toLocaleString(),
      timestamp: Date.now()
    };

    const targetStudent = students.find(s => s.id === selectedStudent.id);
    if (targetStudent) {
      const updatedStudent = { 
        ...targetStudent, 
        points: targetStudent.points - cost, 
        history: [historyItem, ...targetStudent.history] 
      };
      await saveStudentToDB(updatedStudent);
    }
    setModalType(null);
  };

  // --------------------------------------------------------
  // 4. 기록 복원 (실행 취소) 기능 (DB 연동)
  // --------------------------------------------------------
  const handleUndoHistory = (studentId, historyItem) => {
    showConfirm(`'${historyItem.reason}' 내역을 취소하고 점수를 되돌리시겠습니까?`, async () => {
      const targetStudent = students.find(s => s.id === studentId);
      if (!targetStudent) return;

      const pointAdjustment = historyItem.type === 'add' ? -historyItem.amount : historyItem.amount;
      const updatedStudent = {
        ...targetStudent,
        points: targetStudent.points + pointAdjustment,
        history: targetStudent.history.filter(h => h.id !== historyItem.id) 
      };
      
      await saveStudentToDB(updatedStudent);
      
      // 모달에 열려있는 데이터도 즉시 동기화
      setSelectedStudent(updatedStudent);
    });
  };

  // 화면 필터링 로직
  const activeStudents = students.filter(s => !s.isDeleted);
  
  let currentGradeStudents = activeStudents.filter(s => s.grade.toString() === activeTab);
  if (sortType === 'name') {
    currentGradeStudents.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortType === 'pointsDesc') {
    currentGradeStudents.sort((a, b) => b.points - a.points);
  } else if (sortType === 'pointsAsc') {
    currentGradeStudents.sort((a, b) => a.points - b.points);
  }

  const rankedStudents = [...activeStudents].sort((a, b) => b.points - a.points);

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyTrendingStudents = activeStudents.map(student => {
    const weeklyPoints = student.history
      .filter(h => h.type === 'add' && (h.timestamp || new Date(h.date).getTime()) >= sevenDaysAgo)
      .reduce((sum, h) => sum + h.amount, 0);
    return { ...student, weeklyPoints };
  })
  .filter(s => s.weeklyPoints > 0)
  .sort((a, b) => b.weeklyPoints - a.weeklyPoints)
  .slice(0, 10);

  return (
    <div className="min-h-screen bg-[#F0F8FF] font-sans text-slate-800 pb-20">
      <header className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 shadow-lg text-white">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl text-yellow-300 shadow-inner backdrop-blur-sm border border-white/30">
              <Star size={36} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight drop-shadow-md">독서 지혜 요정 ✨</h1>
              <p className="text-blue-50 text-sm font-bold mt-1 opacity-90">책을 읽고 지혜를 차곡차곡 모아보아요!</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={() => { setModalType('add'); setNewStudent({...newStudent, grade: activeTab >= '1' && activeTab <= '6' ? activeTab : '1'}); }}
              className="flex items-center justify-center gap-2 bg-yellow-400 text-yellow-900 px-6 py-4 rounded-full font-black hover:bg-yellow-300 hover:scale-105 transition-all shadow-lg border-b-4 border-yellow-500"
            >
              <UserPlus size={22} /> 새 친구 등록하기
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto mt-8 px-4">
        {/* 로딩 애니메이션 */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <Loader2 size={64} className="text-blue-500 animate-spin mb-4" />
            <p className="text-lg font-bold text-slate-500 animate-pulse">클라우드에서 데이터를 불러오는 중... 🌱</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-3xl shadow-sm border border-slate-100">
              {[1, 2, 3, 4, 5, 6].map(grade => (
                <button
                  key={grade}
                  onClick={() => setActiveTab(grade.toString())}
                  className={`flex-1 min-w-[80px] py-3 rounded-2xl font-black text-center transition-all ${
                    activeTab === grade.toString() 
                      ? 'bg-blue-500 text-white shadow-md shadow-blue-200 scale-105' 
                      : 'bg-transparent text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {grade}학년
                </button>
              ))}
              <div className="w-px bg-slate-200 mx-1"></div>
              <button
                onClick={() => setActiveTab('ranking')}
                className={`flex-1 min-w-[120px] py-3 rounded-2xl font-black flex justify-center items-center gap-2 transition-all ${
                  activeTab === 'ranking' 
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-200 scale-105' 
                    : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                }`}
              >
                <Trophy size={18} /> 명예의 전당
              </button>
              <button
                onClick={() => setActiveTab('trash')}
                className={`px-6 py-3 rounded-2xl font-black flex justify-center items-center gap-2 transition-all ${
                  activeTab === 'trash' 
                    ? 'bg-slate-700 text-white shadow-md shadow-slate-300 scale-105' 
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <Trash2 size={18} />
              </button>
            </div>

            {/* 1~6학년 학생 목록 화면 */}
            {['1', '2', '3', '4', '5', '6'].includes(activeTab) && (
              <>
                <div className="flex justify-between items-center mb-6 px-2">
                  <h2 className="text-2xl font-black text-slate-700 flex items-center gap-2">
                    <Users className="text-blue-500" /> {activeTab}학년 요정들 ({currentGradeStudents.length}명)
                  </h2>
                  <select 
                    value={sortType} 
                    onChange={(e) => setSortType(e.target.value)}
                    className="bg-white border-2 border-slate-200 text-slate-700 font-bold py-2 px-4 rounded-xl outline-none focus:border-blue-400 cursor-pointer shadow-sm"
                  >
                    <option value="name">이름 순서대로 🔠</option>
                    <option value="pointsDesc">지혜 많은 순 🌟</option>
                    <option value="pointsAsc">지혜 적은 순 🌱</option>
                  </select>
                </div>

                {currentGradeStudents.length === 0 ? (
                  <div className="bg-white rounded-3xl p-16 text-center border-2 border-dashed border-slate-200 shadow-sm">
                    <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users size={40} className="text-slate-400" />
                    </div>
                    <h3 className="text-xl font-black text-slate-600 mb-2">아직 등록된 친구가 없어요!</h3>
                    <p className="text-slate-400 font-bold">오른쪽 위 버튼을 눌러 새 친구를 등록해주세요.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {currentGradeStudents.map(student => (
                      <div key={student.id} className="bg-white rounded-[2rem] shadow-sm hover:shadow-xl transition-all border border-slate-100 overflow-hidden group">
                        <div className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center text-2xl border border-emerald-100 shadow-sm">
                                🌱
                              </div>
                              <div>
                                <h3 className="text-xl font-black text-slate-800">{student.name}</h3>
                                <p className="text-sm font-bold text-slate-400">{student.grade}학년 요정</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleDeleteStudent(student.id)}
                              className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition-colors"
                              title="휴지통으로 보내기"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>

                          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 mb-4 border border-blue-100/50 flex justify-between items-center">
                            <span className="font-bold text-blue-800 flex items-center gap-1">모은 지혜 <Star size={14} className="text-blue-500 fill-current"/></span>
                            <div className="text-3xl font-black text-blue-600 drop-shadow-sm">{student.points}</div>
                          </div>
                        </div>
                        
                        <div className="px-4 pb-4">
                          <div className="p-5 grid grid-cols-2 gap-3 bg-slate-50 rounded-2xl">
                            <button 
                              onClick={() => { setSelectedStudent(student); setGrantData({points: 1, reason: '독서 기록 완료'}); setModalType('grant'); }}
                              className="flex items-center justify-center gap-2 bg-pink-100 text-pink-600 py-3 rounded-xl font-black hover:bg-pink-200 hover:scale-105 transition-all shadow-sm"
                            >
                              <Plus size={18} strokeWidth={3} /> 지혜 쑥쑥
                            </button>
                            <button 
                              onClick={() => { setSelectedStudent(student); setShopData({itemName: '', cost: 1}); setModalType('shop'); }}
                              className="flex items-center justify-center gap-2 bg-orange-100 text-orange-600 py-3 rounded-xl font-black hover:bg-orange-200 hover:scale-105 transition-all shadow-sm"
                            >
                              <ShoppingCart size={18} /> 선물 교환
                            </button>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => { setSelectedStudent(student); setModalType('history'); }}
                          className="w-full py-3 bg-slate-100 text-slate-500 font-bold flex justify-center items-center gap-2 hover:bg-slate-200 transition-colors text-sm"
                        >
                          <History size={16} /> 기록장 열어보기 ({student.history.length})
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* 랭킹 화면 */}
            {activeTab === 'ranking' && (
              <div className="bg-white rounded-[2rem] shadow-xl shadow-amber-100/50 border border-amber-100 p-6 md:p-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 rounded-full blur-3xl -z-10 -mt-20 -mr-20"></div>
                <h2 className="text-3xl font-black text-amber-800 mb-8 flex items-center gap-3">
                  <Trophy className="text-amber-500" size={36} /> 명예의 전당
                </h2>
                
                {rankedStudents.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="text-6xl mb-4">🏆</div>
                    <p className="text-slate-400 font-bold text-lg">아직 순위에 오른 친구가 없어요.</p>
                  </div>
                ) : (
                  <div className="flex flex-col lg:flex-row gap-8">
                    <div className="flex-1">
                      <div className="bg-amber-100 text-amber-800 font-black px-4 py-2 rounded-xl inline-block mb-4">🌟 상위 10위 우수 요정</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {rankedStudents.slice(0, 10).map((student, index) => {
                          let rankStyle = "bg-white border-slate-100 text-slate-600";
                          let rankBadge = "bg-slate-100 text-slate-500";
                          let pointsColor = "text-blue-500";
                          
                          if (index === 0) {
                            rankStyle = "bg-gradient-to-r from-yellow-100 to-amber-50 border-amber-200 scale-[1.02] shadow-md";
                            rankBadge = "bg-gradient-to-br from-yellow-300 to-amber-500 text-white shadow-sm";
                            pointsColor = "text-amber-600";
                          } else if (index === 1) {
                            rankStyle = "bg-gradient-to-r from-slate-100 to-slate-50 border-slate-200 scale-[1.01]";
                            rankBadge = "bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-sm";
                            pointsColor = "text-slate-600";
                          } else if (index === 2) {
                            rankStyle = "bg-gradient-to-r from-orange-100 to-orange-50 border-orange-200 scale-[1.01]";
                            rankBadge = "bg-gradient-to-br from-amber-600 to-orange-700 text-white shadow-sm";
                            pointsColor = "text-orange-700";
                          }

                          return (
                            <div key={student.id} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${rankStyle}`}>
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg shrink-0 ${rankBadge}`}>
                                  {index + 1}
                                </div>
                                <div>
                                  <h4 className="font-black text-lg">{student.name}</h4>
                                  <p className="text-xs font-bold opacity-60">{student.grade}학년</p>
                                </div>
                              </div>
                              <div className={`text-xl font-black ${pointsColor} flex items-center gap-1`}>
                                {student.points} <span className="text-base">🌟</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="lg:w-[500px] w-full flex flex-col">
                      <div className="bg-rose-100 text-rose-800 font-black px-4 py-2 rounded-xl inline-block mb-4 self-start shadow-sm border border-rose-200">🔥 최근 1주일 폭풍 성장 요정</div>
                      
                      {weeklyTrendingStudents.length === 0 ? (
                        <div className="flex-1 flex flex-col justify-center items-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 p-8 min-h-[300px]">
                           <span className="text-4xl mb-4">🌱</span>
                           <p className="text-slate-500 font-bold text-center">아직 최근 1주일 동안<br/>지혜를 쑥쑥 키운 친구가 없어요.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {weeklyTrendingStudents.map((student, index) => (
                            <div key={student.id} className="flex items-center justify-between p-4 rounded-2xl bg-rose-50 border-2 border-rose-100 hover:bg-white hover:shadow-md transition-all">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-300 to-rose-500 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-sm">
                                  {index + 1}
                                </div>
                                <div>
                                  <h4 className="font-black text-slate-800 text-lg">{student.name}</h4>
                                  <p className="text-xs font-bold text-slate-400">{student.grade}학년</p>
                                </div>
                              </div>
                              <div className="text-xl font-black text-rose-600 flex items-center gap-1">
                                +{student.weeklyPoints} <span className="text-base">🚀</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 통합 휴지통 화면 */}
            {activeTab === 'trash' && (
              <div className="bg-slate-100 rounded-[2rem] p-6 md:p-10 border-2 border-dashed border-slate-300">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                  <h2 className="text-2xl font-black text-slate-700 flex items-center gap-2">
                    <Trash2 className="text-slate-400" /> 휴지통 ({deletedStudents.length})
                  </h2>
                  
                  {deletedStudents.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
                      <button 
                        onClick={handleSelectAllTrash}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                      >
                        {selectedTrashIds.length === deletedStudents.length ? (
                          <><CheckSquare size={18} className="text-blue-500"/> 전체 해제</>
                        ) : (
                          <><Square size={18} className="text-slate-400"/> 전체 선택</>
                        )}
                      </button>
                      
                      {selectedTrashIds.length > 0 && (
                        <>
                          <div className="w-px h-6 bg-slate-200 mx-1"></div>
                          <button 
                            onClick={handleBatchRestore}
                            className="flex items-center gap-1 px-4 py-2 text-sm font-black bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-xl transition-colors"
                          >
                            <RotateCcw size={16}/> 선택 복구 ({selectedTrashIds.length})
                          </button>
                          <button 
                            onClick={handleBatchDelete}
                            className="flex items-center gap-1 px-4 py-2 text-sm font-black bg-rose-100 text-rose-600 hover:bg-rose-200 rounded-xl transition-colors"
                          >
                            <Trash2 size={16}/> 선택 삭제 ({selectedTrashIds.length})
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                
                {deletedStudents.length === 0 ? (
                  <div className="text-center py-16">
                    <Trash2 size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-400 font-bold text-lg">휴지통이 비어있습니다.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {deletedStudents.map(student => {
                      const isSelected = selectedTrashIds.includes(student.id);
                      
                      return (
                        <div 
                          key={student.id} 
                          className={`relative bg-white p-5 rounded-2xl shadow-sm border-2 transition-all cursor-pointer ${
                            isSelected ? 'border-blue-400 ring-2 ring-blue-100 opacity-100' : 'border-transparent border-slate-200 opacity-80 hover:opacity-100'
                          }`}
                          onClick={() => handleToggleTrashSelect(student.id)}
                        >
                          <div className="absolute top-4 right-4">
                            {isSelected ? (
                              <CheckSquare size={24} className="text-blue-500" />
                            ) : (
                              <Square size={24} className="text-slate-300" />
                            )}
                          </div>

                          <div className="mb-4 pr-8">
                            <h3 className="text-lg font-black text-slate-700 line-through decoration-slate-300">{student.name}</h3>
                            <p className="text-sm font-bold text-slate-400">{student.grade}학년 / 지혜 {student.points}개</p>
                          </div>
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={() => handleRestoreStudent(student.id)}
                              className="flex-1 py-2 bg-slate-50 text-blue-600 rounded-xl font-bold flex justify-center items-center gap-1 hover:bg-blue-100 transition-colors border border-slate-100"
                            >
                              <RotateCcw size={16} /> 복구
                            </button>
                            <button 
                              onClick={() => handlePermanentDelete(student.id)}
                              className="flex-1 py-2 bg-slate-50 text-rose-600 rounded-xl font-bold flex justify-center items-center gap-1 hover:bg-rose-100 transition-colors border border-slate-100"
                            >
                              <Trash2 size={16} /> 삭제
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* --- 모달 창들 (이전과 동일) --- */}

      {/* 1. 학생 추가 모달 */}
      {modalType === 'add' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-yellow-400 to-amber-500 p-6 flex justify-between items-center text-white">
              <h3 className="font-black text-2xl flex items-center gap-2"><UserPlus size={28}/> 새 친구 등록</h3>
              <button onClick={() => setModalType(null)} className="hover:bg-white/20 p-2 rounded-xl transition-colors"><X size={24}/></button>
            </div>
            <form onSubmit={handleAddStudent} className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2">몇 학년인가요?</label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6].map(grade => (
                    <button
                      type="button"
                      key={grade}
                      onClick={() => setNewStudent({...newStudent, grade: grade.toString()})}
                      className={`py-3 rounded-xl font-black transition-all ${
                        newStudent.grade === grade.toString()
                          ? 'bg-amber-100 text-amber-800 border-2 border-amber-400'
                          : 'bg-slate-50 text-slate-500 border-2 border-transparent hover:bg-slate-100'
                      }`}
                    >
                      {grade}학년
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2">이름이 무엇인가요?</label>
                <input 
                  type="text" 
                  autoFocus
                  placeholder="예: 홍길동"
                  className="w-full p-4 border-2 border-slate-100 rounded-2xl bg-slate-50 focus:ring-4 focus:ring-amber-100 outline-none font-bold text-lg"
                  value={newStudent.name}
                  onChange={e => setNewStudent({...newStudent, name: e.target.value})}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setModalType(null)} className="flex-1 p-4 rounded-2xl font-black bg-slate-100 text-slate-500 hover:bg-slate-200">취소</button>
                <button type="submit" disabled={!newStudent.name.trim()} className="flex-1 p-4 rounded-2xl font-black bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-amber-200">등록 완료!</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. 지혜(점수) 부여 모달 */}
      {modalType === 'grant' && selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-pink-400 to-rose-500 p-6 flex justify-between items-center text-white">
              <h3 className="font-black text-2xl flex items-center gap-2"><Award size={28}/> 지혜 쑥쑥!</h3>
              <button onClick={() => setModalType(null)} className="hover:bg-white/20 p-2 rounded-xl transition-colors"><X size={24}/></button>
            </div>
            <form onSubmit={handleGrantWisdom} className="p-8 space-y-6">
              <div className="text-center bg-pink-50 p-4 rounded-2xl border border-pink-100">
                <p className="text-pink-600 font-bold mb-1">우리 {selectedStudent.name} 친구에게</p>
                <p className="text-lg font-black text-pink-800">몇 점의 지혜를 줄까요? 🌟</p>
              </div>
              
              <div className="flex items-center justify-center gap-4 py-2">
                <button 
                  type="button" 
                  onClick={() => setGrantData(prev => ({...prev, points: Math.max(1, parseInt(prev.points || 0) - 1)}))}
                  className="w-16 h-16 rounded-[1.25rem] bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 font-black text-4xl flex items-center justify-center transition-all shadow-inner active:scale-95"
                >
                  -
                </button>
                <div className="relative flex-1 max-w-[140px]">
                  <input 
                    type="number" 
                    min="1"
                    className="w-full text-center text-6xl font-black bg-transparent outline-none text-pink-500 py-2"
                    value={grantData.points}
                    onChange={e => setGrantData({...grantData, points: e.target.value})}
                  />
                </div>
                <button 
                  type="button" 
                  onClick={() => setGrantData(prev => ({...prev, points: parseInt(prev.points || 0) + 1}))}
                  className="w-16 h-16 rounded-[1.25rem] bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 font-black text-4xl flex items-center justify-center transition-all shadow-inner active:scale-95"
                >
                  +
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[1, 5, 10, 20].map(pt => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => setGrantData({...grantData, points: pt})}
                    className={`py-3 rounded-xl font-black text-lg transition-all border-2 ${
                      parseInt(grantData.points) === pt
                        ? 'bg-pink-500 border-pink-500 text-white shadow-md shadow-pink-200 scale-105' 
                        : 'bg-white border-slate-100 text-slate-500 hover:bg-pink-50 hover:border-pink-200'
                    }`}
                  >
                    +{pt}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <label className="block text-sm font-black text-slate-700 mb-2">무엇을 잘했나요? (이유) 칭찬해요 👏</label>
                <input 
                  type="text" 
                  className="w-full p-4 border-2 border-slate-100 rounded-2xl bg-slate-50 focus:ring-4 focus:ring-pink-100 outline-none font-bold"
                  value={grantData.reason}
                  onChange={e => setGrantData({...grantData, reason: e.target.value})}
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalType(null)} className="flex-1 p-4 rounded-2xl font-black bg-slate-100 text-slate-500 hover:bg-slate-200">다음에 줄게요</button>
                <button type="submit" className="flex-1 p-4 rounded-2xl font-black bg-pink-500 text-white hover:bg-pink-600 shadow-md shadow-pink-200">지혜 부여하기!</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. 물품 구입 (차감) 모달 */}
      {modalType === 'shop' && selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-orange-400 to-amber-500 p-6 flex justify-between items-center text-white">
              <h3 className="font-black text-2xl flex items-center gap-2"><ShoppingCart size={28}/> 선물 교환소 🎁</h3>
              <button onClick={() => setModalType(null)} className="hover:bg-white/20 p-2 rounded-xl transition-colors"><X size={24}/></button>
            </div>
            <form onSubmit={handleUseWisdom} className="p-8 space-y-6">
              <div className="bg-orange-50 p-5 rounded-2xl flex justify-between items-center border-2 border-orange-100">
                <span className="font-black text-orange-800">현재 모은 지혜</span>
                <span className="text-3xl font-black text-orange-600">{selectedStudent.points} 🌟</span>
              </div>
              
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2">어떤 선물을 교환할까요?</label>
                <input 
                  type="text" 
                  autoFocus
                  placeholder="예: 간식 세트, 귀여운 지우개"
                  className="w-full p-4 border-2 border-slate-100 rounded-2xl bg-slate-50 focus:ring-4 focus:ring-orange-100 outline-none font-bold text-lg"
                  value={shopData.itemName}
                  onChange={e => setShopData({...shopData, itemName: e.target.value})}
                />
              </div>
              
              <div className="pt-2">
                <label className="block text-sm font-black text-slate-700 mb-4 text-center">필요한 지혜는 몇 개인가요?</label>
                
                <div className="flex items-center justify-center gap-4">
                  <button 
                    type="button" 
                    onClick={() => setShopData(prev => ({...prev, cost: Math.max(1, parseInt(prev.cost || 0) - 1)}))}
                    className="w-16 h-16 rounded-[1.25rem] bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 font-black text-4xl flex items-center justify-center transition-all shadow-inner active:scale-95"
                  >
                    -
                  </button>
                  <div className="relative flex-1 max-w-[140px]">
                    <input 
                      type="number" 
                      min="1"
                      className="w-full text-center text-6xl font-black bg-transparent outline-none text-orange-600 py-2"
                      value={shopData.cost}
                      onChange={e => setShopData({...shopData, cost: e.target.value})}
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setShopData(prev => ({...prev, cost: parseInt(prev.cost || 0) + 1}))}
                    className="w-16 h-16 rounded-[1.25rem] bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 font-black text-4xl flex items-center justify-center transition-all shadow-inner active:scale-95"
                  >
                    +
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-4">
                  {[1, 5, 10, 20].map(pt => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setShopData({...shopData, cost: pt})}
                      className={`py-3 rounded-xl font-black text-lg transition-all border-2 ${
                        parseInt(shopData.cost) === pt
                          ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-200 scale-105' 
                          : 'bg-white border-slate-100 text-slate-500 hover:bg-orange-50 hover:border-orange-200'
                      }`}
                    >
                      {pt}개
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setModalType(null)} className="flex-1 p-4 rounded-2xl font-black bg-slate-100 text-slate-500 hover:bg-slate-200">안 살래요</button>
                <button type="submit" className="flex-1 p-4 rounded-2xl font-black bg-orange-500 text-white hover:bg-orange-600 shadow-md shadow-orange-200">교환 완료!</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. 기록장 모달 */}
      {modalType === 'history' && selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-slate-800 p-6 flex justify-between items-center text-white shrink-0">
              <h3 className="font-black text-2xl flex items-center gap-2"><History size={28}/> {selectedStudent.name}의 기록장</h3>
              <button onClick={() => setModalType(null)} className="hover:bg-white/20 p-2 rounded-xl transition-colors"><X size={24}/></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              {selectedStudent.history.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-bold">아직 아무런 기록이 없어요.</div>
              ) : (
                <div className="space-y-3">
                  {selectedStudent.history.map((h, i) => (
                    <div key={h.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-md text-xs font-black ${h.type === 'add' ? 'bg-pink-100 text-pink-600' : 'bg-orange-100 text-orange-600'}`}>
                            {h.type === 'add' ? '획득' : '사용'}
                          </span>
                          <span className="text-sm font-black text-slate-700">{h.reason}</span>
                        </div>
                        <div className="text-xs font-bold text-slate-400">{h.date}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`font-black text-lg ${h.type === 'add' ? 'text-pink-600' : 'text-orange-600'}`}>
                          {h.type === 'add' ? '+' : '-'}{h.amount}
                        </span>
                        {i === 0 && (
                          <button 
                            onClick={() => handleUndoHistory(selectedStudent.id, h)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-xl transition-colors"
                            title="방금 전 작업 실행 취소"
                          >
                            <RotateCcw size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 bg-white border-t border-slate-100 shrink-0">
              <button onClick={() => setModalType(null)} className="w-full p-4 rounded-2xl font-black bg-slate-100 text-slate-500 hover:bg-slate-200 text-lg">기록장 덮기</button>
            </div>
          </div>
        </div>
      )}

      {/* 5. 공통 알림/확인 모달 */}
      {dialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden transform transition-all p-6 text-center border-4 border-blue-50">
            <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              {dialog.type === 'alert' ? <span className="text-4xl">⚠️</span> : <span className="text-4xl">❓</span>}
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-6 break-keep leading-relaxed whitespace-pre-line">{dialog.message}</h3>
            <div className="flex gap-3">
              {dialog.type === 'confirm' && (
                <button
                  onClick={() => setDialog({ isOpen: false, type: '', message: '', onConfirm: null })}
                  className="flex-1 p-4 rounded-2xl font-black bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all"
                >
                  아니오
                </button>
              )}
              <button
                onClick={() => {
                  if (dialog.onConfirm) dialog.onConfirm();
                  setDialog({ isOpen: false, type: '', message: '', onConfirm: null });
                }}
                className="flex-1 p-4 rounded-2xl font-black bg-blue-500 text-white hover:bg-blue-600 shadow-md transition-all"
              >
                네, 맞아요
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}