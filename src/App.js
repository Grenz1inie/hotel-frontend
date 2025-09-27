import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import AntLayout from './components/AntLayout';
import RoomListPage from './pages/RoomList';
import RoomDetailPage from './pages/RoomDetail';
import AdminDemo from './pages/AdminDemo';
import Login from './pages/Login';
import { ProtectedRoute, RoleRoute } from './routes/guards';
import { AuthProvider } from './context/AuthContext';
import ErrorPage from './pages/ErrorPage';
import MyBookings from './pages/UserDashboard';
import HotelLanding from './pages/HotelLanding';

function RoomListRoute() {
  const navigate = useNavigate();
  return <RoomListPage onOpen={(id)=>navigate(`/rooms/${id}`)} />;
}

function RoomDetailRoute() {
  const navigate = useNavigate();
  const { id } = useParams();
  return <RoomDetailPage id={id} onBack={()=>navigate('/rooms')} />;
}

function HotelLandingRoute() {
  const navigate = useNavigate();
  return <HotelLanding onEnterRooms={() => navigate('/rooms')} />;
}

export default function App(){
  return (
    <BrowserRouter>
      <AuthProvider>
        <AntLayout>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/error" element={<ErrorPage />} />
            <Route path="/" element={<HotelLandingRoute/>} />
            <Route path="/rooms" element={<RoomListRoute/>} />
            <Route path="/rooms/:id" element={<RoomDetailRoute/>} />
            <Route path="/admin" element={<RoleRoute role="ADMIN"><AdminDemo/></RoleRoute>} />
            <Route path="/me/bookings" element={<ProtectedRoute><MyBookings/></ProtectedRoute>} />
          </Routes>
        </AntLayout>
      </AuthProvider>
    </BrowserRouter>
  );
}
