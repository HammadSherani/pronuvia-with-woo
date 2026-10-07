"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Country, State } from "country-state-city";
import toast from "react-hot-toast";
import { registerPhysician, type RegisterPhysicianState } from "@/actions/website/register-physician";

const ALL_COUNTRIES = Country.getAllCountries();



const inp    = "w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-[#1b3b6f] focus:ring-1 focus:ring-[#1b3b6f]/30 transition bg-white";
const inpErr = "w-full border border-red-400 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-300 transition bg-white";
const lbl    = "block text-xs font-semibold text-gray-600 mb-1.5";

function R() { return <span className="text-red-500"> *</span>; }

function Field({ label, req = true, error, children }: { label: string; req?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={lbl}>{label}{req && <R />}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export function PhysicianRegisterForm() {
  const [state, action, pending] = useActionState<RegisterPhysicianState, FormData>(registerPhysician, undefined);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [customSpecialty, setCustomSpecialty] = useState("");
  const [terms, setTerms] = useState(false);
  console.log("terms", terms);
  
  const [email, setEmail] = useState(state?.values?.email ?? "");
  const [emailTouched, setEmailTouched] = useState(false);
  const [countryIso, setCountryIso] = useState("US");
  const [selectedState, setSelectedState] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const states = useMemo(() => State.getStatesOfCountry(countryIso), [countryIso]);
  const countryName = useMemo(
    () => ALL_COUNTRIES.find((c) => c.isoCode === countryIso)?.name ?? "",
    [countryIso]
  );

  const e = state?.errors ?? {};
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const serverEmailError = e.email?.[0];
  const emailError = serverEmailError && serverEmailError !== "Valid email is required"
    ? serverEmailError
    : (emailTouched || !!serverEmailError) && !emailIsValid
      ? "Valid email is required"
      : undefined;

  function toggleSpecialty(s: string) {
    setSpecialties((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);
  }

  function addCustomSpecialty() {
    // Supports pasting/typing several specialties at once, comma-separated —
    // each becomes its own tag instead of one long combined entry.
    const parts = customSpecialty.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) {
      setSpecialties((prev) => {
        const next = [...prev];
        for (const p of parts) if (!next.includes(p)) next.push(p);
        return next;
      });
    }
    setCustomSpecialty("");
  }

  function onPasswordChange(val: string) {
    setPassword(val);
    if (!val) setPasswordError("Password is required");
    else if (confirmPassword && val !== confirmPassword) setPasswordError("Passwords do not match");
    else setPasswordError("");
  }
  function onConfirmPasswordChange(val: string) {
    setConfirmPassword(val);
    if (!val) setPasswordError("Please confirm your password");
    else if (val !== password) setPasswordError("Passwords do not match");
    else setPasswordError("");
  }

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (state.errors) {
      const firstError = Object.values(state.errors).flat()[0];
      if (firstError) toast.error(firstError);
    }
    if (state?.values?.country) {
      const match = ALL_COUNTRIES.find((c) => c.name === state.values!.country);
      if (match) setCountryIso(match.isoCode);
    }
    if (state?.values?.state !== undefined) {
      setSelectedState(state.values.state);
    }
  }, [state]);

  if (state?.success) {
    return (
      <div className="py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-[#1b3b6f]/10 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-[#1b3b6f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
        </div>
        <h2 className="text-3xl font-normal text-gray-900 mb-3" style={{ fontFamily: "Georgia, serif" }}>
          Registration Submitted!
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed max-w-md mx-auto">{state.message}</p>
      </div>
    );
  }

  function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    const submittedTerms = new FormData(ev.currentTarget).get("termsAccepted") === "true";
    if (!terms || !submittedTerms) {
      ev.preventDefault();
      setTerms(false);
      toast.error("You must agree to the Terms and Conditions");
    } else if (!password || !confirmPassword) {
      ev.preventDefault();
      setPasswordError(!password ? "Password is required" : "Please confirm your password");
    } else if (password !== confirmPassword) {
      ev.preventDefault();
      setPasswordError("Passwords do not match");
    } else {
      setPasswordError("");
      // Require the terms agreement again if the server returns a validation
      // error, and keep the submit button disabled while that request runs.
      setTerms(false);
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="space-y-5" noValidate>
      <input type="hidden" name="fieldsOfSpeciality" value={JSON.stringify(specialties)} />

      {state?.message && !state.success && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {state.message}
        </div>
      )}

      {/* Email + Login ID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Email" error={emailError}>
          <input required name="email" type="email" placeholder="doctor@clinic.com"
            value={email}
            onChange={(ev) => { setEmail(ev.target.value); setEmailTouched(true); }}
            className={emailError ? inpErr : inp} />
        </Field>
        <Field label="Login ID / Username" error={e.loginId?.[0]}>
          <input required name="loginId" type="text" autoComplete="username" placeholder="e.g. dr.jane.doe" defaultValue={state?.values?.loginId} className={e.loginId ? inpErr : inp} />
          <p className="text-[11px] text-gray-400 mt-1">Used to sign in (3–64 characters — letters, numbers, . _ - @ +; email addresses allowed)</p>
        </Field>
      </div>

      {/* Password + Confirm Password */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Password" error={e.password?.[0] || passwordError}>
          <div className="relative">
            <input required name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="At least 8 characters"
              value={password} onChange={(ev) => onPasswordChange(ev.target.value)} className={`${e.password || passwordError ? inpErr : inp} pr-11`} />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-700">
              {showPassword ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.3 9.5 7-.4 1.2-1.3 2.5-2.5 3.6M6.2 6.2C3.9 7.6 2.8 9.8 2.5 12c1 2.7 4.5 7 9.5 7 1.5 0 2.8-.4 4-1" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </Field>
        <Field label="Confirm Password" error={e.confirmPassword?.[0] || passwordError}>
          <div className="relative">
            <input required name="confirmPassword" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" placeholder="Re-enter password"
              value={confirmPassword} onChange={(ev) => onConfirmPasswordChange(ev.target.value)} className={`${e.confirmPassword || passwordError ? inpErr : inp} pr-11`} />
            <button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-700">
              {showConfirmPassword ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.3 9.5 7-.4 1.2-1.3 2.5-2.5 3.6M6.2 6.2C3.9 7.6 2.8 9.8 2.5 12c1 2.7 4.5 7 9.5 7 1.5 0 2.8-.4 4-1" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </Field>
      </div>

      {/* First Name + Last Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="First Name" error={e.firstName?.[0]}>
          <input required name="firstName" placeholder="Jane" defaultValue={state?.values?.firstName} className={e.firstName ? inpErr : inp} />
        </Field>
        <Field label="Last Name" error={e.lastName?.[0]}>
          <input required name="lastName" placeholder="Doe" defaultValue={state?.values?.lastName} className={e.lastName ? inpErr : inp} />
        </Field>
      </div>

      {/* SAC Therapy */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="How did you hear about AIC Therapy?" error={e.aictherapy?.[0]}>
          <input required name="aictherapy" placeholder="e.g. Conference, Referral, Online..." defaultValue={state?.values?.aictherapy} className={e.aictherapy ? inpErr : inp} />
        </Field>
        <div className="hidden sm:block" />
      </div>

      {/* License + Website */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Doctor's License Number" error={e.license?.[0]}>
          <input required name="license" placeholder="LIC-000000" defaultValue={state?.values?.license} className={e.license ? inpErr : inp} />
        </Field>
        <Field label="Website" req={false} error={e.websiteLink?.[0]}>
          <input name="websiteLink" placeholder="www.yourclinic.com" defaultValue={state?.values?.websiteLink} className={e.websiteLink ? inpErr : inp} />
        </Field>
      </div>

      {/* Country — hidden real name field + visible iso select */}
      

      {/* Address */}
      <Field label="Address Line 1" error={e.addressOne?.[0]}>
        <input required name="addressOne" placeholder="123 Medical Drive" defaultValue={state?.values?.addressOne} className={e.addressOne ? inpErr : inp} />
      </Field>
      <Field label="Address Line 2" req={false}>
        <input name="addressTwo" placeholder="Suite 400 (optional)" defaultValue={state?.values?.addressTwo} className={inp} />
      </Field>


      <Field label="Country" error={e.country?.[0]}>
        <input type="hidden" name="country" value={countryName} />
        <select
          value={countryIso}
          onChange={(ev) => { setCountryIso(ev.target.value); }}
          className={e.country ? inpErr : inp}
        >
          {ALL_COUNTRIES.map((c) => (
            <option key={c.isoCode} value={c.isoCode}>{c.name}</option>
          ))}
        </select>
      </Field>

      {/* City + State */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
         <Field label="State / Province" error={e.state?.[0]}>
          {states.length > 0 ? (
            <select
              name="state"
              value={selectedState}
              onChange={(ev) => setSelectedState(ev.target.value)}
              className={e.state ? inpErr : inp}
            >
              <option value="" disabled>Select state…</option>
              {states.map((s) => (
                <option key={s.isoCode} value={s.name}>{s.name}</option>
              ))}
            </select>
          ) : (
            <input name="state" placeholder="State / Province / Region" defaultValue={state?.values?.state} className={e.state ? inpErr : inp} />
          )}
        </Field>
        <Field label="City" error={e.city?.[0]}>
          <input required name="city" placeholder="e.g. Los Angeles" defaultValue={state?.values?.city} className={e.city ? inpErr : inp} />
        </Field>
       
      </div>

      {/* Zip + Phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Zip Code" error={e.zipCode?.[0]}>
          <input required name="zipCode" placeholder="90001" defaultValue={state?.values?.zipCode} className={e.zipCode ? inpErr : inp} />
        </Field>
        <Field label="Phone" error={e.phone?.[0]}>
          <input required name="phone" type="tel" placeholder="+1 555 000 0000" defaultValue={state?.values?.phone} className={e.phone ? inpErr : inp} />
        </Field>
      </div>

      {/* Office Contact + Fax */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Office Contact Person" error={e.officeContactNumber?.[0]}>
          <input required name="officeContactNumber" placeholder="Office contact number" defaultValue={state?.values?.officeContactNumber} className={e.officeContactNumber ? inpErr : inp} />
        </Field>
        <Field label="Fax" req={false} error={e.fax?.[0]}>
          <input name="fax" placeholder="+1 555 000 0002" defaultValue={state?.values?.fax} className={e.fax ? inpErr : inp} />
        </Field>
      </div>

      {/* Practice Name + Years */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name of Practice" error={e.nameOfPractice?.[0]}>
          <input required name="nameOfPractice" placeholder="City Health Clinic" defaultValue={state?.values?.nameOfPractice} className={e.nameOfPractice ? inpErr : inp} />
        </Field>
        <Field label="Number of Years in Practice" error={e.yearsInPractice?.[0]}>
          <input required name="yearsInPractice" type="number" min="0" placeholder="10" defaultValue={state?.values?.yearsInPractice} className={e.yearsInPractice ? inpErr : inp} />
        </Field>
      </div>

      {/* Credential + Patients Seen Per Month */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Credential" req={false} error={e.credential?.[0]}>
          <input name="credential" placeholder="e.g. MD, DO, DC, ND, RN" defaultValue={state?.values?.credential} className={e.credential ? inpErr : inp} />
        </Field>
        <Field label="Patients Seen Per Month" req={false} error={e.patientsPerMonth?.[0]}>
          <input name="patientsPerMonth" type="number" min="0" placeholder="40" defaultValue={state?.values?.patientsPerMonth} className={e.patientsPerMonth ? inpErr : inp} />
        </Field>
      </div>

      {/* Specialties */}
      <div>
        <label className={lbl}>Fields of Specialties<R /></label>

        {/* Custom specialty */}
        <div className="flex gap-2 mt-3">
          <input
            value={customSpecialty}
            onChange={(ev) => setCustomSpecialty(ev.target.value)}
            onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); addCustomSpecialty(); } }}
            placeholder="e.g. Cardiology, Neurology"
            className={`${inp} flex-1`}
          />
          <button
            type="button"
            onClick={addCustomSpecialty}
            className="px-5 py-2.5 bg-[#1b3b6f] hover:bg-[#162f5c] text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap shadow-sm"
          >
            Add
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">
          Type specialty and click Add — separate multiple specialties with commas (e.g. &ldquo;Cardiology, Neurology&rdquo;)
        </p>

        {(e as Record<string, string[]>).fieldsOfSpeciality?.[0] && (
          <p className="text-xs text-red-500 mt-1">{(e as Record<string, string[]>).fieldsOfSpeciality[0]}</p>
        )}
        {specialties.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {specialties.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#1b3b6f]/10 text-[#1b3b6f] text-xs rounded-full font-medium">
                {s}
                <button type="button" onClick={() => toggleSpecialty(s)} className="hover:text-red-500 transition-colors">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Terms */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" name="termsAccepted" value="true" required checked={terms} onChange={(ev) => setTerms(ev.target.checked)}
          className="mt-0.5 w-4 h-4 accent-[#1b3b6f] cursor-pointer" />
        <span className="text-sm text-gray-600">
          I agree to the{" "}
          <a href="/terms" target="_blank" className="text-[#1b3b6f] hover:underline">Terms and Conditions</a>
        </span>
      </label>
      {e.termsAccepted?.[0] && <p className="text-xs text-red-500 -mt-4">{e.termsAccepted[0]}</p>}

      <button type="submit" disabled={pending || !terms}
        className="w-full py-3 bg-[#1b3b6f] hover:bg-[#162f5c] disabled:bg-gray-400 disabled:opacity-100 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2">
        {pending && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
        {pending ? "Submitting…" : "Submit Registration"}
      </button>
    </form>
  );
}
