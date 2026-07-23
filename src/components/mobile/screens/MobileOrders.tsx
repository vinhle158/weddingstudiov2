import React from 'react';
import Orders from '../../Orders';

interface MobileOrdersProps {
  userRole: string;
  initialSelectedOrderId?: string;
  initialOpenCreateForCustomerId?: string;
  initialCreateCustomerDraft?: {
    full_name?: string;
    phone?: string | null;
    notes?: string | null;
  };
  initialCreatePrefill?: {
    package_name?: string;
    package_price?: number;
    total_amount?: number;
    notes?: string | null;
  };
  onNavigate: (tab: string, arg?: any) => void;
}

export default function MobileOrders({
  userRole,
  initialSelectedOrderId,
  initialOpenCreateForCustomerId,
  initialCreateCustomerDraft,
  initialCreatePrefill,
  onNavigate,
}: MobileOrdersProps) {
  return (
    <Orders
      userRole={userRole}
      initialSelectedOrderId={initialSelectedOrderId}
      initialOpenCreateForCustomerId={initialOpenCreateForCustomerId}
      initialCreateCustomerDraft={initialCreateCustomerDraft}
      initialCreatePrefill={initialCreatePrefill}
      onNavigate={onNavigate}
      isMobile
    />
  );
}
