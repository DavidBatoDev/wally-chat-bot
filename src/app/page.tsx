import { FileText, Languages, Upload, Sparkles } from "lucide-react";
import Link from "next/link";

export default function TranslateHomepage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center">
      <div className="max-w-4xl mx-auto p-8 text-center">
        {/* Logo/Brand */}
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-3xl">W</span>
          </div>
        </div>

        {/* Main Title */}
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          Welcome to <span className="text-blue-600">Wally</span>
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
          Your AI-powered document translation assistant. Upload any document
          and get instant, accurate translations.
        </p>

        {/* Feature Icons */}
        <div className="flex justify-center items-center gap-8 mb-12">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-3">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
            <span className="text-sm text-gray-600">Edit Your Document</span>
          </div>
          <div className="w-8 h-px bg-gray-300"></div>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-3">
              <Languages className="w-8 h-8 text-blue-400" />
            </div>
            <span className="text-sm text-gray-600">AI Translation</span>
          </div>
          <div className="w-8 h-px bg-gray-300"></div>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-3">
              <Sparkles className="w-8 h-8 text-blue-300" />
            </div>
            <span className="text-sm text-gray-600">Instant Results</span>
          </div>
        </div>

        {/* Main CTA Button */}
        <div className="relative">
          <Link href="/pdf-editor">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xl px-12 py-6 rounded-2xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-200">
              <div className="flex items-center justify-center">
                <Upload className="w-7 h-7 mr-4" />
                Translate Your Document
              </div>
            </button>
          </Link>

          {/* Decorative elements removed for theme consistency */}
        </div>

        {/* Supporting Text */}
        <p className="text-gray-500 mt-8 text-sm max-w-md mx-auto">
          Supported formats: PDF, DOCX, JPG, PNG, and more.
          <br />
          Translate to and from 100+ languages instantly.
        </p>

        {/* Trust Indicators */}
        <div className="mt-16 flex justify-center items-center gap-8 text-xs text-gray-400">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
            Secure & Private
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
            AI-Powered
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-blue-200 rounded-full mr-2"></div>
            Lightning Fast
          </div>
        </div>
      </div>
    </div>
  );
}
