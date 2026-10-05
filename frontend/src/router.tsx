import { createBrowserRouter } from 'react-router-dom'
import { SideNavLayout } from './components/SideNavLayout'
import LibraryPage from './pages/LibraryPage'
import ProfilePage from './pages/ProfilePage'
import JobPage from './pages/JobPage'
import QuizPage from './pages/QuizPage'
import InterviewPage from './pages/InterviewPage'
import ReviewPage from './pages/ReviewPage'
import SettingsPage from './pages/SettingsPage'
import NotFoundPage from './pages/NotFoundPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <SideNavLayout />,
    children: [
      { index: true, element: <LibraryPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'job', element: <JobPage /> },
      { path: 'quiz', element: <QuizPage /> },
      { path: 'interview', element: <InterviewPage /> },
      { path: 'review', element: <ReviewPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
