import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { User, Camera, Briefcase, Languages, Clock, Calendar } from "lucide-react";

type UserRole = "project-manager" | "translator";

interface AvailabilityHours {
  start_time: string;
  end_time: string;
  timezone: string;
  days_of_week: number[];
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "tl", name: "Tagalog" },
  { code: "ru", name: "Russian" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
];

export default function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [loading, setLoading] = useState(false);
  
  // Translator-specific fields
  const [availabilityHours, setAvailabilityHours] = useState<AvailabilityHours>({
    start_time: "09:00:00",
    end_time: "17:00:00",
    timezone: "UTC",
    days_of_week: [1, 2, 3, 4, 5], // Monday to Friday
  });
  const [specialtyLanguages, setSpecialtyLanguages] = useState<string[]>([]);

  const handleSignUp = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setLoading(true);

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      setLoading(false);
      return;
    }

    if (!fullName || !role) {
      toast.error("Please fill in all required fields");
      setLoading(false);
      return;
    }

    if (role === "translator" && specialtyLanguages.length === 0) {
      toast.error("Please select at least one specialty language");
      setLoading(false);
      return;
    }

    try {
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName,
            avatar_url: avatarUrl,
            role: role,
            ...(role === "translator" && {
              availability_hours: availabilityHours,
              specialty_languages: specialtyLanguages,
            }),
          },
        },
      });

      if (authError) throw authError;

      // If you have a profiles table, you might want to insert additional data here
      // const { error: profileError } = await supabase
      //   .from('profiles')
      //   .insert({
      //     id: authData.user?.id,
      //     full_name: fullName,
      //     avatar_url: avatarUrl,
      //     role: role,
      //     ...(role === "translator" && {
      //       availability_hours: availabilityHours,
      //       specialty_languages: specialtyLanguages,
      //     }),
      //   });

      toast.success("Check your email for the confirmation link!");
      router.push("/auth/login");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An error occurred during sign up";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day: number) => {
    setAvailabilityHours((prev) => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter((d) => d !== day)
        : [...prev.days_of_week, day].sort((a, b) => a - b),
    }));
  };

  const toggleLanguage = (langCode: string) => {
    setSpecialtyLanguages((prev) =>
      prev.includes(langCode)
        ? prev.filter((l) => l !== langCode)
        : [...prev, langCode]
    );
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-wally-50 via-white to-wally-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div>
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-gradient-to-r from-wally to-wally-dark flex items-center justify-center shadow-lg wally-shadow">
                <span className="text-white text-2xl font-bold">W</span>
              </div>
            </div>
            <h2 className="mt-6 text-center text-3xl font-bold bg-gradient-to-r from-wally to-wally-dark bg-clip-text text-transparent">
              Create your account
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="font-medium text-wally hover:text-wally-dark transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSignUp}>
            {/* Basic Information */}
            <div className="space-y-4">
              <div>
                <label htmlFor="full-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-wally">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="full-name"
                    name="full-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="appearance-none relative block w-full pl-10 pr-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-wally focus:border-wally focus:z-10 sm:text-sm transition-all"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address <span className="text-wally">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-wally focus:border-wally focus:z-10 sm:text-sm transition-all"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label htmlFor="avatar-url" className="block text-sm font-medium text-gray-700 mb-1">
                  Avatar URL (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Camera className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="avatar-url"
                    name="avatar-url"
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="appearance-none relative block w-full pl-10 pr-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-wally focus:border-wally focus:z-10 sm:text-sm transition-all"
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role <span className="text-wally">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole("project-manager")}
                    className={`relative rounded-lg border-2 p-4 flex flex-col items-center space-y-2 transition-all ${
                      role === "project-manager"
                        ? "border-wally bg-wally-50 shadow-md"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Briefcase className={`h-6 w-6 ${role === "project-manager" ? "text-wally" : "text-gray-400"}`} />
                    <span className={`text-sm font-medium ${role === "project-manager" ? "text-wally-dark" : "text-gray-700"}`}>
                      Project Manager
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("translator")}
                    className={`relative rounded-lg border-2 p-4 flex flex-col items-center space-y-2 transition-all ${
                      role === "translator"
                        ? "border-wally bg-wally-50 shadow-md"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Languages className={`h-6 w-6 ${role === "translator" ? "text-wally" : "text-gray-400"}`} />
                    <span className={`text-sm font-medium ${role === "translator" ? "text-wally-dark" : "text-gray-700"}`}>
                      Translator
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Translator-specific fields */}
            {role === "translator" && (
              <div className="space-y-4 p-4 bg-wally-50 rounded-lg border border-wally-100">
                <h3 className="text-sm font-semibold text-wally-dark flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  Translator Information
                </h3>
                
                {/* Specialty Languages */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Specialty Languages <span className="text-wally">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-white rounded-lg border border-gray-200">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => toggleLanguage(lang.code)}
                        className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                          specialtyLanguages.includes(lang.code)
                            ? "bg-wally text-white shadow-sm"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                  {specialtyLanguages.length > 0 && (
                    <p className="mt-2 text-xs text-gray-600">
                      Selected: {specialtyLanguages.map(code => 
                        LANGUAGES.find(l => l.code === code)?.name
                      ).join(", ")}
                    </p>
                  )}
                </div>

                {/* Availability Hours */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-wally" />
                    Availability Hours
                  </label>
                  <div className="space-y-3 bg-white p-3 rounded-lg border border-gray-200">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Start Time</label>
                        <input
                          type="time"
                          value={availabilityHours.start_time.substring(0, 5)}
                          onChange={(e) =>
                            setAvailabilityHours((prev) => ({
                              ...prev,
                              start_time: `${e.target.value}:00`,
                            }))
                          }
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-wally focus:border-wally"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">End Time</label>
                        <input
                          type="time"
                          value={availabilityHours.end_time.substring(0, 5)}
                          onChange={(e) =>
                            setAvailabilityHours((prev) => ({
                              ...prev,
                              end_time: `${e.target.value}:00`,
                            }))
                          }
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-wally focus:border-wally"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Working Days</label>
                      <div className="flex gap-1">
                        {DAYS_OF_WEEK.map((day) => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleDay(day.value)}
                            className={`flex-1 py-1 text-xs rounded transition-all ${
                              availabilityHours.days_of_week.includes(day.value)
                                ? "bg-wally text-white shadow-sm"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Timezone</label>
                      <select
                        value={availabilityHours.timezone}
                        onChange={(e) =>
                          setAvailabilityHours((prev) => ({
                            ...prev,
                            timezone: e.target.value,
                          }))
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-wally focus:border-wally"
                      >
                        <option value="UTC">UTC</option>
                        <option value="EST">EST</option>
                        <option value="PST">PST</option>
                        <option value="CET">CET</option>
                        <option value="JST">JST</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Password fields */}
            <div className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-wally">*</span>
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-wally focus:border-wally focus:z-10 sm:text-sm transition-all"
                  placeholder="••••••••"
                />
              </div>
              
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password <span className="text-wally">*</span>
                </label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-wally focus:border-wally focus:z-10 sm:text-sm transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white wally-gradient hover:bg-wally-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wally disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg wally-shadow"
              >
                {loading ? (
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  </span>
                ) : null}
                {loading ? "Creating account..." : "Create account"}
              </button>
            </div>
          </form>

          <div className="text-center text-xs text-gray-500 mt-4">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="text-wally hover:text-wally-dark transition-colors">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-wally hover:text-wally-dark transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
