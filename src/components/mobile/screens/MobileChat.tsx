import Chat from '../../Chat';

interface MobileChatProps {
  userId: string;
  userRole: string;
  onNavigate?: (tab: string, arg?: any) => void;
}

export default function MobileChat({ userId, userRole, onNavigate }: MobileChatProps) {
  return <Chat userId={userId} userRole={userRole} isMobile onNavigate={onNavigate} />;
}
