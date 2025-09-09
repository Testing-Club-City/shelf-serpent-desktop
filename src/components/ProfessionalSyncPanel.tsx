import React from 'react';
import ProfessionalSyncManager from './sync/ProfessionalSyncManager';
import SyncStatusIndicator from './sync/SyncStatusIndicator';

const ProfessionalSyncPanel: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header with compact status indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Professional Sync</h1>
          <p className="text-gray-600 mt-1">
            Manage bidirectional synchronization between local and cloud data
          </p>
        </div>
        <SyncStatusIndicator showDetails={false} />
      </div>

      {/* Main sync manager */}
      <ProfessionalSyncManager />
    </div>
  );
};

export default ProfessionalSyncPanel;
