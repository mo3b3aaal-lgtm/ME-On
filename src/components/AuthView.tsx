import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User,
  Phone,
  BookOpen,
  Building,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { UserAccount } from '../types';
import { db } from '../utils/storage';
import { ClassyOwlMascot } from './ClassyOwlMascot';

interface AuthViewProps {
  onLoginSuccess: (user: UserAccount) => void;
}

type AuthMode = 'login' | 'register' | 'forgot_password';

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Login Form States
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Register Form States
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regSubject, setRegSubject] = useState('رياضيات');
  const [regCenter, setRegCenter] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRecoveryPin, setRegRecoveryPin] = useState('');

  // Forgot Password States
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetRecoveryPin, setResetRecoveryPin] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Handle Login Submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!loginIdentifier.trim()) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني أو رقم الهاتف أو اسم المستخدم.');
      return;
    }
    if (!loginPassword) {
      setErrorMessage('يرجى إدخال كلمة المرور.');
      return;
    }

    setLoading(true);
    try {
      const res = await db.login(loginIdentifier, loginPassword);
      setLoading(false);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(res.error || 'فشل تسجيل الدخول. تأكد من صحة البيانات.');
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err.message || 'حدث خطأ أثناء الاتصال بالخادم.');
    }
  };

  // Quick Demo Account Auto-Fill
  const handleQuickDemo = () => {
    const accounts = db.getAccounts();
    const firstAcc = accounts[0];
    if (firstAcc) {
      setLoginIdentifier(firstAcc.email);
      setLoginPassword(firstAcc.password || 'password123');
    } else {
      setLoginIdentifier('teacher@example.com');
      setLoginPassword('password123');
    }
    setSuccessMessage('تم تعبئة بيانات الحساب التجريبي المخصص للمعلم.');
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // Handle Register Submit
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!regName.trim()) {
      setErrorMessage('يرجى إدخال اسم المعلم بالكامل.');
      return;
    }
    if (!regEmail.trim()) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني.');
      return;
    }
    if (!regPassword || regPassword.length < 4) {
      setErrorMessage('يجب ألا تقل كلمة المرور عن 4 أحرف أو أرقام.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage('كلمتا المرور غير متطابقتين.');
      return;
    }

    setLoading(true);
    try {
      const res = await db.registerAccount({
        name: regName,
        email: regEmail,
        phone: regPhone,
        subject: regSubject,
        centerOrSchool: regCenter,
        password: regPassword,
        recoveryPin: regRecoveryPin || '123456',
        securityQuestion: 'ما هي مادتك الأساسية؟',
        securityAnswer: regSubject,
      });

      setLoading(false);
      if (res.success && res.user) {
        setSuccessMessage('تم إنشاء الحساب بنجاح في السيرفر السحابي! جاري الدخول...');
        setTimeout(() => {
          onLoginSuccess(res.user!);
        }, 500);
      } else {
        setErrorMessage(res.error || 'حدث خطأ أثناء إنشاء الحساب.');
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err.message || 'حدث خطأ في الاتصال أثناء إنشاء الحساب.');
    }
  };

  // Handle Forgot Password Submit
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!resetIdentifier.trim()) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني أو الهاتف المرتبط بالحساب.');
      return;
    }
    if (!resetRecoveryPin.trim()) {
      setErrorMessage('يرجى إدخال كود الاسترداد السري (PIN).');
      return;
    }
    if (!resetNewPassword || resetNewPassword.length < 4) {
      setErrorMessage('يجب ألا تقل كلمة المرور الجديدة عن 4 أحرف أو أرقام.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setErrorMessage('كلمتا المرور الجديدتان غير متطابقتين.');
      return;
    }

    setLoading(true);
    try {
      const res = await db.resetPassword(resetIdentifier, resetNewPassword, resetRecoveryPin);
      setLoading(false);
      if (res.success) {
        setSuccessMessage('تمت إعادة تعيين كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.');
        setLoginIdentifier(resetIdentifier);
        setLoginPassword(resetNewPassword);
        setTimeout(() => {
          setMode('login');
          setSuccessMessage(null);
        }, 1500);
      } else {
        setErrorMessage(res.error || 'فشل التحقق من كود الاسترداد.');
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err.message || 'حدث خطأ أثناء استعادة كلمة المرور.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto android-scrollbar flex flex-col justify-between min-h-full bg-[#14152C] text-white select-none relative" dir="rtl">
      
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-[#7B61FF]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 left-0 w-72 h-72 bg-[#FF5E62]/15 rounded-full blur-3xl pointer-events-none" />

      {/* Hero Section with Classy Mascot (Inspired by the Reference Onboarding Screen) */}
      <div className="relative z-10 pt-6 pb-2 px-5 text-center flex flex-col items-center">
        
        {/* Mascot in Glowing Oval Canvas */}
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 mb-3 flex items-center justify-center">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-[#7B61FF]/30 to-[#FF5E62]/30 blur-md transform -rotate-3" />
          <div className="relative w-full h-full rounded-3xl bg-[#1E1F3D] border border-white/15 flex items-center justify-center shadow-xl overflow-hidden">
            <ClassyOwlMascot size="lg" glow={false} pose="smart" />
          </div>
          
          {/* Floating small badge */}
          <div className="absolute -bottom-2 -left-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#FF5E62] to-[#FF758C] text-white text-[10px] font-extrabold shadow-md flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" />
            <span>Classy</span>
          </div>
        </div>

        <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-1.5 justify-center">
          <span>مرحباً بك في</span>
          <span className="text-[#FF758C]">كلاسي</span>
        </h1>
        <p className="text-xs text-slate-300 font-medium max-w-xs mt-1">
          منظومة المعلم الذكية لإدارة الطلاب والمجموعات والحصص والحسابات
        </p>
      </div>

      {/* S-Curved Main White/Lavender Surface Container */}
      <div className="relative z-10 bg-white rounded-t-[36px] shadow-2xl p-5 sm:p-6 text-[#14152C] flex-1 flex flex-col justify-between mt-2 border-t border-[#E8E4F5]">
        
        <div className="space-y-4">
          {/* Mode Selector Tab (Pill Switcher) */}
          {mode !== 'forgot_password' ? (
            <div className="flex items-center p-1.5 bg-[#F4F3FA] rounded-2xl border border-[#E8E4F5]">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  clearMessages();
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-[#1E1F3D] text-white shadow-md'
                    : 'text-[#727494] hover:text-[#14152C]'
                }`}
              >
                تسجيل الدخول
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  clearMessages();
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-[#1E1F3D] text-white shadow-md'
                    : 'text-[#727494] hover:text-[#14152C]'
                }`}
              >
                إنشاء حساب جديد
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between border-b border-[#E8E4F5] pb-2.5">
              <h2 className="text-sm font-bold text-[#14152C] flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-[#FF5E62]" />
                <span>استعادة كلمة المرور</span>
              </h2>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  clearMessages();
                }}
                className="text-xs text-[#7B61FF] hover:text-[#6C5CE7] font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>العودة للدخول</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-2xl text-xs font-bold flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl text-xs font-bold flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#14152C] mb-1.5">البريد الإلكتروني / الهاتف / الاسم</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="مثال: teacher@example.com أو 01000000000"
                    className="w-full bg-[#F4F3FA] border border-[#E8E4F5] rounded-2xl p-3 pr-10 text-xs text-[#14152C] font-semibold focus:outline-none focus:border-[#7B61FF] focus:ring-2 focus:ring-[#7B61FF]/20 transition-all placeholder:text-[#9A9CB8]"
                  />
                  <Mail className="w-4 h-4 text-[#7B61FF] absolute right-3.5 top-3.5" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-[#14152C]">كلمة المرور</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot_password');
                      clearMessages();
                    }}
                    className="text-[11px] text-[#FF5E62] hover:text-[#FF758C] font-bold cursor-pointer transition-colors"
                  >
                    نسيت كلمة المرور؟
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#F4F3FA] border border-[#E8E4F5] rounded-2xl p-3 pr-10 pl-10 text-xs text-[#14152C] font-semibold focus:outline-none focus:border-[#7B61FF] focus:ring-2 focus:ring-[#7B61FF]/20 transition-all placeholder:text-[#9A9CB8]"
                  />
                  <Lock className="w-4 h-4 text-[#7B61FF] absolute right-3.5 top-3.5" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3.5 top-3.5 text-[#9A9CB8] hover:text-[#14152C] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-[#727494]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded-md border-[#E8E4F5] text-[#FF5E62] focus:ring-0 accent-[#FF5E62]"
                  />
                  <span>تذكر تسجيل الدخول دائماً</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-2xl btn-coral text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#FF5E62]/35 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <span>جاري التحقق والدخول...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>تسجيل الدخول الآن</span>
                  </>
                )}
              </button>

              {/* Quick Demo Helper Button */}
              <div className="pt-2 border-t border-[#E8E4F5]">
                <button
                  type="button"
                  onClick={handleQuickDemo}
                  className="w-full py-2.5 px-3 rounded-2xl bg-[#F4F3FA] hover:bg-[#ECEAF6] text-[#7B61FF] border border-[#D6CEF2] font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#FFAA2C]" />
                  <span>دخول سريع بحساب المعلم التجريبي (Demo Account)</span>
                </button>
              </div>
            </form>
          )}

          {/* 2. REGISTER FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#14152C] mb-1">اسم المعلم بالكامل *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="مثال: أ/ محمد أحمد"
                    className="w-full bg-[#F4F3FA] border border-[#E8E4F5] rounded-2xl p-2.5 pr-9 text-xs text-[#14152C] font-semibold focus:outline-none focus:border-[#7B61FF]"
                  />
                  <User className="w-4 h-4 text-[#7B61FF] absolute right-3 top-3" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#14152C] mb-1">المادة الأساسية *</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={regSubject}
                      onChange={(e) => setRegSubject(e.target.value)}
                      placeholder="رياضيات، لغة عربية..."
                      className="w-full bg-[#F4F3FA] border border-[#E8E4F5] rounded-2xl p-2.5 pr-8 text-xs text-[#14152C] font-semibold focus:outline-none focus:border-[#7B61FF]"
                    />
                    <BookOpen className="w-3.5 h-3.5 text-[#7B61FF] absolute right-2.5 top-3" />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#14152C] mb-1">رقم الهاتف</label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="01000000000"
                      className="w-full bg-[#F4F3FA] border border-[#E8E4F5] rounded-2xl p-2.5 pr-8 text-xs text-[#14152C] font-semibold focus:outline-none focus:border-[#7B61FF]"
                    />
                    <Phone className="w-3.5 h-3.5 text-[#7B61FF] absolute right-2.5 top-3" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#14152C] mb-1">البريد الإلكتروني / اسم المستخدم *</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="teacher@example.com"
                    className="w-full bg-[#F4F3FA] border border-[#E8E4F5] rounded-2xl p-2.5 pr-9 text-xs text-[#14152C] font-semibold focus:outline-none focus:border-[#7B61FF]"
                  />
                  <Mail className="w-4 h-4 text-[#7B61FF] absolute right-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#14152C] mb-1">اسم السنتر / المدرسة</label>
                <div className="relative">
                  <input
                    type="text"
                    value={regCenter}
                    onChange={(e) => setRegCenter(e.target.value)}
                    placeholder="مثال: سنتر الأوائل"
                    className="w-full bg-[#F4F3FA] border border-[#E8E4F5] rounded-2xl p-2.5 pr-9 text-xs text-[#14152C] font-semibold focus:outline-none focus:border-[#7B61FF]"
                  />
                  <Building className="w-4 h-4 text-[#7B61FF] absolute right-3 top-3" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#14152C] mb-1">كلمة المرور *</label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#F4F3FA] border border-[#E8E4F5] rounded-2xl p-2.5 text-xs text-[#14152C] font-semibold focus:outline-none focus:border-[#7B61FF]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#14152C] mb-1">تأكيد المرور *</label>
                  <input
                    type="password"
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#F4F3FA] border border-[#E8E4F5] rounded-2xl p-2.5 text-xs text-[#14152C] font-semibold focus:outline-none focus:border-[#7B61FF]"
                  />
                </div>
              </div>

              {/* Recovery PIN */}
              <div>
                <label className="block font-bold text-[#14152C] mb-1 flex items-center justify-between">
                  <span>كود استعادة سري (PIN) *</span>
                  <span className="text-[10px] text-[#727494]">لاسترجاع الحساب عند النسيان</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={6}
                    value={regRecoveryPin}
                    onChange={(e) => setRegRecoveryPin(e.target.value)}
                    placeholder="مثال: 123456"
                    className="w-full bg-[#F4F3FA] border border-[#E8E4F5] rounded-2xl p-2.5 pr-9 text-xs text-[#14152C] font-semibold focus:outline-none focus:border-[#7B61FF]"
                  />
                  <KeyRound className="w-4 h-4 text-[#FF5E62] absolute right-3 top-3" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-2xl btn-coral text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#FF5E62]/35 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <span>جاري إنشاء الحساب...</span>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>إنشاء الحساب وبدء الاستخدام</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* 3. FORGOT PASSWORD FORM */}
          {mode === 'forgot_password' && (
            <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
              <p className="text-[11px] text-[#727494] leading-relaxed">
                أدخل بريدك الإلكتروني أو رقم هاتفك المسجل مسبقاً، مع كود الاستعادة السري (PIN) لتعيين كلمة مرور جديدة.
              </p>

              <div>
                <label className="block font-bold text-[#14152C] mb-1">البريد الإلكتروني أو الهاتف</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={resetIdentifier}
                    onChange={(e) => setResetIdentifier(e.target.value)}
                    placeholder="مثال: teacher@example.com"
                    className="w-full bg-[#F4F3FA] border border-[#E8E4F5] rounded-2xl p-2.5 pr-9 text-xs text-[#14152C] font-semibold focus:outline-none focus:border-[#7B61FF]"
                  />
                  <Mail className="w-4 h-4 text-[#7B61FF] absolute right-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#14152C] mb-1">كود الاستعادة السري (PIN)</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={resetRecoveryPin}
                    onChange={(e) => setResetRecoveryPin(e.target.value)}
                    placeholder="الكود المحدد عند التسجيل (الافتراضي: 123456)"
                    className="w-full bg-[#F4F3FA] border border-[#E8E4F5] rounded-2xl p-2.5 pr-9 text-xs text-[#14152C] font-semibold focus:outline-none focus:border-[#7B61FF]"
                  />
                  <KeyRound className="w-4 h-4 text-[#FF5E62] absolute right-3 top-3" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#14152C] mb-1">كلمة المرور الجديدة</label>
                  <input
                    type="password"
                    required
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#F4F3FA] border border-[#E8E4F5] rounded-2xl p-2.5 text-xs text-[#14152C] font-semibold focus:outline-none focus:border-[#7B61FF]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#14152C] mb-1">تأكيد الجديدة</label>
                  <input
                    type="password"
                    required
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#F4F3FA] border border-[#E8E4F5] rounded-2xl p-2.5 text-xs text-[#14152C] font-semibold focus:outline-none focus:border-[#7B61FF]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-2xl btn-coral text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#FF5E62]/35 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <span>جاري تحديث كلمة المرور...</span>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>تحديث كلمة المرور والدخول</span>
                  </>
                )}
              </button>
            </form>
          )}

        </div>

        {/* Footer Info */}
        <div className="text-center text-[11px] text-[#727494] mt-4 pt-2 border-t border-[#E8E4F5]/60">
          <p className="font-medium">تطبيق Classy • نظام إدارة المعلم والمجموعات الذكي</p>
        </div>

      </div>

    </div>
  );
};
