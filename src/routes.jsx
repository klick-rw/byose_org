// src/routes.jsx (snippet)
import AdminMovies from "./pages/dashboard/AdminMovies.jsx";
import Feedbacks from "./pages/dashboard/Feedbacks.jsx";
import AddMovie from "./pages/dashboard/AddMovie.jsx";
import CreatePost from "./pages/dashboard/CreatePost.jsx";
import UpdateLocation from "./pages/dashboard/UpdateLocation.jsx";
import CustomerInsights from "./pages/dashboard/CustomerInsights.jsx";
import RemoteUsageHistory from "./pages/dashboard/RemoteUsageHistory.jsx";
import DeviceInsights from "./pages/dashboard/DeviceInsights.jsx";
import RevenueInsights from "./pages/dashboard/RevenueInsights.jsx";
import AuditLogs from "./pages/dashboard/AuditLogs.jsx";
import CameraFleet from "./pages/dashboard/CameraFleet.jsx";

// auth imports
import SignIn from "./pages/auth/Sign-in.jsx";
import Otp from "./pages/auth/otp.jsx";
import ResetPassword from "./pages/auth/ResetPassword.jsx";
import BroadcastPage from "./pages/dashboard/Broadcastpage.jsx";
import {
  CursorArrowRaysIcon,
  TvIcon,
  ArrowRightOnRectangleIcon,
  KeyIcon,
  UserIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import NotificationCentre from "./pages/dashboard/NotificationCentre.jsx";

const iconClass = "w-5 h-5";

export const routes = [
  {
    // This section is used by App.jsx to render routes,
    // but filtered out by Sidenav.jsx
    title: "Auth Pages",
    layout: "auth",
    pages: [
      {
        icon: <ArrowRightOnRectangleIcon className={iconClass} />,
        name: "Sign In",
        path: "sign-in",
        element: <SignIn />,
      },
      {
        icon: <KeyIcon className={iconClass} />,
        name: "OTP",
        path: "otp/:email",
        element: <Otp />,
      },
      {
        icon: <UserIcon className={iconClass} />,
        name: "Reset Password",
        path: "reset-password",
        element: <ResetPassword />,
      },
    ],
  },{
    title: "Projects",
    layout: "dashboard",
    pages: [
      {
        icon: <CursorArrowRaysIcon className={iconClass} />,
        name: "Presence Eye",
        isDropdown: true,
        subPages: [
          
          {
            name: "Customer Insights", 
            path: "presence-eye-buttons/analytics",
            element: <CustomerInsights />,
          },
          {
            name: "Device Insights",
            path: "presence-eye-buttons/insights",
            element: <DeviceInsights />,
          },
          {
            name: "Revenue Insights", 
            path: "presence-eye-buttons/revenue",
            element: <RevenueInsights />,
          }, 
          {
            name: "Update Location",
            path: "presence-eye-buttons/location",
            element: <UpdateLocation />,
          },
          {
            name: "Broadcasters",
            path: "presence-eye-buttons/broadcasters",
            element: <BroadcastPage />,
          },
          {
            name: "Notification Centre",
            path: "presence-eye-buttons/notification-centre",
            element: <NotificationCentre/>,
          },
          {
            name: "Audit Logs",
            path: "presence-eye-buttons/audit-logs",
            element: <AuditLogs />,
          },
          {
            name: "Camera Fleet",
            path: "presence-eye-buttons/camera-fleet",
            element: <CameraFleet />,
          },
          {
            name: "Remote History",
            path: "presence-eye-buttons/remote/:serialNumber",
            element: <RemoteUsageHistory />,
            hidden: true,
          },
        ],
      },
      {
        icon: <TvIcon className={iconClass} />,
        name: "Byose TV",
        isDropdown: true,
        subPages: [
          {
            name: "Manage Movies",
            path: "byose-tv/manage-movies", // This is the 'link' used in the card
            element: <AdminMovies />,
          },
          {
            name: "Add Movies",
            path: "byose-tv/add-movie",
            element: <AddMovie />,
          },
          {
            name: "Add Trends",
            path: "byose-tv/add-post",
            element: <CreatePost />,
          },
          {
            name: "Feedbacks",
            path: "byose-tv/feedbacks",
            element: <Feedbacks />,
          },
        ],
      },
    ],
  },
];

export default routes;
