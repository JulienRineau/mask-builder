import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';

function Login() {
  const navigate = useNavigate();

  const onSuccess = (response) => {
    localStorage.setItem('googleToken', response.credential);
    navigate('/dashboard');
  };

  const onError = () => {
    console.log('Login Failed');
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-6">Mask Builder</h1>
        <p className="text-gray-600 mb-8 text-center">
          Sign in with your Google account to access the Mask Builder application.
        </p>
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={onSuccess}
            onError={onError}
            useOneTap
          />
        </div>
      </div>
    </div>
  );
}

export default Login; 