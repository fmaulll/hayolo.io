import React, { useState } from 'react';
import { DocumentViewer } from './components/DocumentViewer';
import { FileUploader } from './components/FileUploader';

function App() {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="min-h-screen bg-gray-900">
      {file ? (
        <DocumentViewer file={file} onClose={() => setFile(null)} />
      ) : (
        <FileUploader onFileSelect={setFile} />
      )}
    </div>
  );
}

export default App; 