import React from 'react'
import api from '../utils/api'
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const VerifyPaymentPage = () => {

  const [statusMsg, setStatusMsg] = useState('Verifying Payment...');
  const navigate = useNavigate();
  const location = useLocation();
  const search = location.search || '';

  useEffect(() => {
    let cancelled = false;

    const verifyPayment = async () => {
      const params = new URLSearchParams(search);
      const rawSession = params.get('session_id');
      const session_id = rawSession ? rawSession.trim() : null;
      const payment_status = params.get('payment_status');

      if (payment_status === 'cancel') {
        navigate('/checkout', {replace: true});
        return;
      }

      if (!session_id) {
        setStatusMsg('No session id provided in the URL');
        return;
      }

      try {
        setStatusMsg('Confirming payment with server...');

        const res = await api.get(`/api/payments/confirm`, {
          params: {session_id},
          timeout: 15000,
        });

        if (cancelled) return;

        if (res?.data?.success) {
          setStatusMsg('Payment confirm. Redirecting...');
          navigate('/bookings', {replace: true});
          return;
        }
        else {
          const msg = res?.data?.message || 'Payment not completed!'
          setStatusMsg(msg);
        }
      } 

      catch (err) {
        console.error("Verification failed", err);

        const status = err?.response?.status;
        const serverMsg = err?.response?.data?.message;

        if (status === 404) {
          setStatusMsg(serverMsg || "Payment session not found!");
        } else if (status === 400) {
          setStatusMsg(serverMsg || "Payment not completed!");
        } else {
          setStatusMsg(serverMsg || "Error occured. Try again.");
        }
      }
    };
    verifyPayment();

    return () => {
      cancelled = true;
    };
  }, [search, navigate]);

  return (
    <div className=' min-h-screen flex items-center justify-center text-white p-4'>
      <div className=' text-center max-w-lg'>
        <p className=' mb-2'>{statusMsg}</p>
        <p className=' text-sm opacity-70'>
          If this page shows 'session not found', copy the 'session_id' from your URL and verify it with your backend logs or support contact.
        </p>
      </div>
    </div>
  );
};

export default VerifyPaymentPage