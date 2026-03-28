import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided.');
      return;
    }

    api.get(`/api/auth/verify-email?token=${token}`)
      .then((res) => {
        setStatus('success');
        setMessage(res.data?.message || 'Email verified successfully!');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err?.response?.data?.message || 'Verification failed. The link may have expired.');
      });
  }, [token]);

  const pageStyle = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(to bottom right, #FFFBF5, #FFF7ED)',
    padding: '16px',
  };

  const cardStyle = {
    background: '#fff',
    border: '1px solid rgba(251,146,60,0.2)',
    borderRadius: '24px',
    padding: '40px 32px',
    maxWidth: '420px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
  };

  const btnStyle = (bg) => ({
    display: 'inline-block',
    padding: '12px 28px',
    background: bg,
    color: '#fff',
    borderRadius: '14px',
    border: 'none',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '8px',
  });

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {status === 'loading' && (
          <>
            <div style={{
              width: 48, height: 48, border: '3px solid #fb923c',
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 1s linear infinite', margin: '0 auto 16px',
            }} />
            <p style={{ color: '#64748b' }}>Verifying your email…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </>
        )}
        {status === 'success' && (
          <>
            <FaCheckCircle style={{ color: '#10b981', fontSize: 48, marginBottom: 16 }} />
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Verified!</h1>
            <p style={{ color: '#64748b', marginBottom: 24 }}>{message}</p>
            <button onClick={() => navigate('/login', { replace: true })} style={btnStyle('#fb923c')}>
              Go to Login
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <FaTimesCircle style={{ color: '#ef4444', fontSize: 48, marginBottom: 16 }} />
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Verification Failed</h1>
            <p style={{ color: '#64748b', marginBottom: 24 }}>{message}</p>
            <button onClick={() => navigate('/', { replace: true })} style={btnStyle('#64748b')}>
              Go Home
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;