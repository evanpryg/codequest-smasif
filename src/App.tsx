import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { RequireStudent, RequireTeacher } from './components/guards'
import LoginPage from './pages/LoginPage'
import ChapterDetailPage from './pages/guru/ChapterDetailPage'
import ClassDetailPage from './pages/guru/ClassDetailPage'
import LiveClassPage from './pages/guru/LiveClassPage'
import PresentationPage from './pages/guru/PresentationPage'
import QuestEditPage from './pages/guru/QuestEditPage'
import RecapPage from './pages/guru/RecapPage'
import SemesterDetailPage from './pages/guru/SemesterDetailPage'
import TeacherDashboard from './pages/guru/TeacherDashboard'
import YearDetailPage from './pages/guru/YearDetailPage'
import YearsPage from './pages/guru/YearsPage'
import ChangePasswordPage from './pages/siswa/ChangePasswordPage'
import QuestWorkspacePage from './pages/siswa/QuestWorkspacePage'
import StudentHome from './pages/siswa/StudentHome'

/** Arahkan root sesuai sesi yang aktif. */
function RootRedirect() {
  const { state } = useAuth()
  if (state.status === 'loading') return null
  if (state.status === 'teacher') return <Navigate to="/guru" replace />
  if (state.status === 'student') return <Navigate to="/siswa" replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireTeacher />}>
        <Route path="/guru" element={<TeacherDashboard />} />
        <Route path="/guru/struktur" element={<YearsPage />} />
        <Route path="/guru/tahun/:yearId" element={<YearDetailPage />} />
        <Route path="/guru/semester/:semesterId" element={<SemesterDetailPage />} />
        <Route path="/guru/kelas/:classId" element={<ClassDetailPage />} />
        <Route path="/guru/kelas/:classId/live" element={<LiveClassPage />} />
        <Route path="/guru/kelas/:classId/rekap" element={<RecapPage />} />
        <Route path="/guru/presentasi/:questId/:studentId" element={<PresentationPage />} />
        <Route path="/guru/chapter/:chapterId" element={<ChapterDetailPage />} />
        <Route path="/guru/quest/:questId" element={<QuestEditPage />} />
      </Route>

      <Route element={<RequireStudent />}>
        <Route path="/siswa" element={<StudentHome />} />
        <Route path="/siswa/quest/:questId" element={<QuestWorkspacePage />} />
        <Route path="/siswa/ganti-password" element={<ChangePasswordPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
