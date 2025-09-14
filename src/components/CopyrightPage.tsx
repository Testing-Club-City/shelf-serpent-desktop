import { ArrowLeft } from 'lucide-react';

interface CopyrightPageProps {
  onBack: () => void;
}

export function CopyrightPage({ onBack }: CopyrightPageProps) {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center z-50 overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.1%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221.5%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] animate-pulse"></div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <img
            src="/tamnet-new.png"
            alt="Tamnet Logo"
            className="w-24 h-24 mx-auto mb-6 drop-shadow-2xl"
          />
          <h1 className="text-4xl font-bold text-white mb-4">Copyright Notice</h1>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-400 to-orange-400 mx-auto rounded-full"></div>
        </div>

        {/* Content */}
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm p-8 rounded-2xl border border-orange-400/30 shadow-2xl">
          <div className="text-blue-100 space-y-6">
            <div className="text-center">
              <p className="text-xl font-semibold text-orange-300 mb-2">
                © 2025 Tamnet Systems & Lenix Corp
              </p>
              <p className="text-lg text-white font-medium">All Rights Reserved</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-700/50 p-6 rounded-lg border border-slate-600">
                <h3 className="font-bold text-white mb-3 text-lg">Copyright Protection</h3>
                <p className="text-sm leading-relaxed">
                  This software and its source code are protected by copyright law. 
                  No part of this application may be reproduced, distributed, or 
                  transmitted in any form without prior written authorization from 
                  Tamnet Systems.
                </p>
              </div>

              <div className="bg-slate-700/50 p-6 rounded-lg border border-slate-600">
                <h3 className="font-bold text-white mb-3 text-lg">Developer Information</h3>
                <div className="text-sm space-y-2">
                  <p><strong className="text-orange-300">Created by:</strong> Denis Ndirangu Kariuki</p>
                  <p><strong className="text-orange-300">Contact:</strong> 0792508277</p>
                  <p><strong className="text-orange-300">Organization:</strong> Tamnet Systems & Lenix Corp</p>
                </div>
              </div>
            </div>

            <div className="bg-red-900/20 border border-red-500/30 p-6 rounded-lg">
              <h3 className="font-bold text-red-300 mb-3 text-lg">⚠️ Legal Warning</h3>
              <p className="text-sm leading-relaxed text-red-100">
                Unauthorized copying, modification, distribution, or reverse engineering 
                of this software is strictly prohibited and may result in legal action. 
                This includes but is not limited to:
              </p>
              <ul className="list-disc list-inside mt-3 text-sm text-red-100 space-y-1">
                <li>Creating copies without authorization</li>
                <li>Modifying or adapting the source code</li>
                <li>Distributing or selling copies</li>
                <li>Reverse engineering the application</li>
              </ul>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 p-6 rounded-lg">
              <h3 className="font-bold text-blue-300 mb-3 text-lg">License Information</h3>
              <p className="text-sm leading-relaxed">
                This software is licensed exclusively to authorized users. 
                For licensing inquiries, partnership opportunities, or technical support, 
                please contact Tamnet Systems directly.
              </p>
            </div>

            <div className="text-center pt-4">
              <p className="text-xs text-blue-300/60 italic">
                Kisii School Library Management System - Professional Edition v1.0.0
              </p>
            </div>
          </div>
        </div>

        {/* Back button */}
        <div className="flex justify-center mt-8">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-orange-600 hover:from-blue-700 hover:to-orange-700 text-white px-8 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Application</span>
          </button>
        </div>
      </div>

      {/* Corner decorations */}
      <div className="absolute top-0 left-0 w-40 h-40 bg-gradient-to-br from-orange-500/10 to-transparent rounded-br-full"></div>
      <div className="absolute bottom-0 right-0 w-40 h-40 bg-gradient-to-tl from-blue-500/10 to-transparent rounded-tl-full"></div>
    </div>
  );
}
