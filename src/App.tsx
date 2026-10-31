import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import AIHomeworkHelper from "./pages/AIHomeworkHelper";
import VoiceStemTutor from "./pages/VoiceStemTutor";
import ARStemLabs from "./pages/ARStemLabs";
import STEMChallengeArena from "./pages/STEMChallengeArena";
import STEMStoryMode from "./pages/STEMStoryMode";
import AICareerCoach from "./pages/AICareerCoach";
import STEMMarketplace from "./pages/STEMMarketplace";
import BookPublish from "./pages/BookPublish";
import MarketplaceDashboard from "./pages/MarketplaceDashboard";
import BookReader from "./pages/BookReader";
import MyOrders from "./pages/MyOrders";
import STEMReels from "./pages/STEMReels";
import LiveStream from "./pages/LiveStream";
import UserProfile from "./pages/UserProfile";
import MyProfile from "./pages/MyProfile";
import PDFConverter from "./pages/PDFConverter";
import Leaderboard from "./pages/Leaderboard";
import Notifications from "./pages/Notifications";
import Cart from "./pages/Cart";
import CareerOpportunities from "./pages/CareerOpportunities";
import AdminPortal from "./pages/AdminPortal";
import NotFound from "./pages/NotFound";
import { FeedbackWidget } from "./components/FeedbackWidget";
import { FeaturePreviewProvider } from "./contexts/FeaturePreviewContext";
import { FeaturePreviewAuthModal } from "./components/FeaturePreviewAuthModal";
import { LiveQuizHub } from "./pages/LiveQuizHub";
import { CreateLiveQuiz } from "./pages/CreateLiveQuiz";
import { LiveQuizLobby } from "./pages/LiveQuizLobby";
import { LiveQuizPlayer } from "./pages/LiveQuizPlayer";
import { LiveQuizResults } from "./pages/LiveQuizResults";
import { LiveQuizFinal } from "./pages/LiveQuizFinal";
import PastQuestionsHub from "./pages/PastQuestionsHub";
import PastQuestionPlayer from "./pages/PastQuestionPlayer";
import PastQuestionResults from "./pages/PastQuestionResults";
import UniversityPastQuestions from "./pages/UniversityPastQuestions";
import SubmitPastQuestions from "./pages/SubmitPastQuestions";
import MySubmissions from "./pages/MySubmissions";
import TutorMarketplace from "./pages/TutorMarketplace";
import TutorProfileView from "./pages/TutorProfileView";
import TutoringRoom from "./pages/TutoringRoom";
import TutorDashboard from "./pages/TutorDashboard";
import TutorBookingDetail from "./pages/TutorBookingDetail";
import StudentBookings from "./pages/StudentBookings";
import VirtualClassesHub from "./pages/VirtualClassesHub";
import VirtualClassroomRoom from "./pages/VirtualClassroomRoom";
import ClassSummaryView from "./pages/ClassSummaryView";
import AboutUs from "./pages/AboutUs";

const queryClient = new QueryClient();

const App = () => (
  <FeaturePreviewProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <FeaturePreviewAuthModal />
          <FeedbackWidget />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/about-us" element={<AboutUs />} />
          <Route path="/dashboard" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/ai-homework-helper" element={<AIHomeworkHelper />} />
          <Route path="/voice-stem-tutor" element={<VoiceStemTutor />} />
          <Route path="/ar-stem-labs" element={<ARStemLabs />} />
          <Route path="/stem-challenge-arena" element={<STEMChallengeArena />} />
          <Route path="/stem-story-mode" element={<STEMStoryMode />} />
          <Route path="/ai-career-coach" element={<AICareerCoach />} />
          <Route path="/marketplace" element={<STEMMarketplace />} />
          <Route path="/marketplace/publish" element={<BookPublish />} />
          <Route path="/marketplace/dashboard" element={<MarketplaceDashboard />} />
          <Route path="/marketplace/book/:bookId" element={<BookReader />} />
          <Route path="/my-orders" element={<MyOrders />} />
          <Route path="/stem-reels" element={<STEMReels />} />
          <Route path="/live/:roomId" element={<LiveStream />} />
          <Route path="/profile/:userId" element={<UserProfile />} />
          <Route path="/my-profile" element={<MyProfile />} />
          <Route path="/pdf-converter" element={<PDFConverter />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/career-opportunities" element={<CareerOpportunities />} />
          <Route path="/admin" element={<AdminPortal />} />
          {/* Live Quiz Routes */}
          <Route path="/live-quiz" element={<LiveQuizHub />} />
          <Route path="/live-quiz/create" element={<CreateLiveQuiz />} />
          <Route path="/live-quiz/:quizId/lobby" element={<LiveQuizLobby />} />
          <Route path="/live-quiz/:quizId/play" element={<LiveQuizPlayer />} />
          <Route path="/live-quiz/:quizId/results" element={<LiveQuizResults />} />
          <Route path="/live-quiz/:quizId/final" element={<LiveQuizFinal />} />
          {/* Past Questions & Exam Preparation Hub */}
          <Route path="/past-questions" element={<PastQuestionsHub />} />
          <Route path="/past-questions/university" element={<UniversityPastQuestions />} />
          <Route path="/past-questions/submit" element={<SubmitPastQuestions />} />
          <Route path="/past-questions/my-submissions" element={<MySubmissions />} />
          <Route path="/past-questions/practice" element={<PastQuestionPlayer />} />
          <Route path="/past-questions/results/:sessionId" element={<PastQuestionResults />} />
          {/* Tutor Discovery & Online Tutoring Marketplace */}
          <Route path="/tutors" element={<TutorMarketplace />} />
          <Route path="/tutor/:tutorId" element={<TutorProfileView />} />
          <Route path="/tutoring/room/:roomId" element={<TutoringRoom />} />
          <Route path="/tutoring/booking/:bookingId" element={<TutorBookingDetail />} />
          <Route path="/my-bookings" element={<StudentBookings />} />
          <Route path="/tutoring/my-bookings" element={<StudentBookings />} />
          <Route path="/tutor/dashboard" element={<TutorDashboard />} />
          {/* Large-Scale Virtual Classes, Meetings & Recordings */}
          <Route path="/virtual-classes" element={<VirtualClassesHub />} />
          <Route path="/virtual-classes/room/:roomId" element={<VirtualClassroomRoom />} />
          <Route path="/virtual-classes/summary/:roomId" element={<ClassSummaryView />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </FeaturePreviewProvider>
);

export default App;
