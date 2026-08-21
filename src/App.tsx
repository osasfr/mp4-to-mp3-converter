import { useState, useRef, DragEvent, ChangeEvent, useEffect } from "react";
import { Upload, FileAudio, FileVideo, ArrowRight, Loader2, Download, RefreshCw, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isFFmpegLoaded, setIsFFmpegLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "processing" | "complete">("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  
  const ffmpegRef = useRef(new FFmpeg());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      const ffmpeg = ffmpegRef.current;
      
      ffmpeg.on('progress', ({ progress, time }) => {
        // progress is a ratio from 0 to 1
        setProgress(Math.round(progress * 100));
      });
      
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      setIsFFmpegLoaded(true);
    } catch (err) {
      console.error(err);
      setError("Failed to load conversion engine. Check your internet connection.");
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.size > 1024 * 1024 * 1024) {
        setError("File size exceeds the 1 GB limit.");
        return;
      }
      if (droppedFile.type.includes("video/mp4") || droppedFile.name.toLowerCase().endsWith(".mp4")) {
        setFile(droppedFile);
        resetState();
      } else {
        setError("Please upload an MP4 file.");
      }
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 1024 * 1024 * 1024) {
        setError("File size exceeds the 1 GB limit.");
        return;
      }
      setFile(selectedFile);
      resetState();
    }
  };

  const resetState = () => {
    setDownloadUrl(null);
    setError(null);
    setProgress(0);
    setPhase("idle");
  };

  const handleConvert = async () => {
    if (!file) return;

    setIsConverting(true);
    setError(null);
    setDownloadUrl(null);
    setProgress(0);
    setPhase("processing");

    try {
      const ffmpeg = ffmpegRef.current;
      
      // Write file to in-memory file system
      await ffmpeg.writeFile('input.mp4', await fetchFile(file));
      
      // Run conversion to MP3
      await ffmpeg.exec(['-i', 'input.mp4', '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', 'output.mp3']);
      
      // Read output
      const data = await ffmpeg.readFile('output.mp3');
      
      // Create blob URL for download
      const blob = new Blob([(data as Uint8Array).buffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      
      const originalName = file.name;
      const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
      setDownloadName(`${baseName}.mp3`);
      setPhase("complete");
    } catch (err: any) {
      console.error(err);
      setError("Conversion failed. The file might not be a valid MP4 or your browser lacks sufficient memory.");
    } finally {
      setIsConverting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setDownloadUrl(null);
    setError(null);
    setPhase("idle");
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-slate-800">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-white/20 p-3 rounded-full flex items-center space-x-3">
              <FileVideo size={28} className="text-white" />
              <ArrowRight size={20} className="text-white/70" />
              <FileAudio size={28} className="text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2 tracking-tight">MP4 to MP3 Converter</h1>
          <p className="text-blue-100 font-medium">Convert your videos to MP3 audio directly in your browser.</p>
        </div>

        {/* Main Content */}
        <div className="p-8">
          {!isFFmpegLoaded && !error && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Loader2 size={40} className="animate-spin mb-4 text-blue-500" />
              <p className="font-medium text-slate-600">Loading local processing engine...</p>
              <p className="text-xs text-slate-400 mt-2">This happens once and works entirely in your browser.</p>
            </div>
          )}

          {error && !isFFmpegLoaded && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3 mb-6">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm">Engine Error</h3>
                <p className="text-sm mt-1 text-red-600">{error}</p>
              </div>
            </div>
          )}

          {isFFmpegLoaded && !file && (
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="bg-blue-100 text-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload size={32} />
              </div>
              <p className="text-lg font-semibold text-slate-700 mb-1">Click or drag your MP4 here</p>
              <p className="text-slate-500 text-sm mb-6">Supports files up to 1 GB. Processed locally.</p>
              <button className="bg-slate-900 text-white px-6 py-2.5 rounded-full font-medium hover:bg-slate-800 transition-colors">
                Select File
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="video/mp4,.mp4"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {file && !downloadUrl && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6 flex flex-col items-center">
              <div className="bg-indigo-100 text-indigo-600 p-4 rounded-full mb-4">
                <FileVideo size={36} />
              </div>
              <p className="font-semibold text-slate-800 mb-1 max-w-full truncate px-4 text-center">
                {file.name}
              </p>
              <p className="text-slate-500 text-sm mb-6">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>

              {isConverting ? (
                <div className="w-full bg-slate-100 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-semibold text-blue-700 uppercase tracking-wider">
                      Converting to MP3...
                    </span>
                    <span className="text-sm font-bold text-slate-700">
                      {progress > 0 ? `${progress}%` : "Please wait"}
                    </span>
                  </div>
                  
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <motion.div 
                      className="h-full rounded-full bg-blue-600"
                      initial={{ width: 0 }}
                      animate={{ width: progress > 0 ? `${progress}%` : "100%" }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-center text-xs text-slate-500 mt-2 gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    Processing locally in your browser
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleConvert}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors flex justify-center items-center gap-2"
                >
                  Convert to MP3
                </button>
              )}
              
              {!isConverting && (
                <button 
                  onClick={handleReset}
                  className="mt-4 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
                >
                  Choose a different file
                </button>
              )}
            </div>
          )}

          {error && isFFmpegLoaded && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3 mb-6">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm">Conversion Error</h3>
                <p className="text-sm mt-1 text-red-600">{error}</p>
              </div>
            </div>
          )}

          {downloadUrl && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-green-50 border border-green-200 rounded-xl p-8 text-center"
            >
              <div className="bg-green-100 text-green-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileAudio size={40} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Conversion Complete!</h3>
              <p className="text-slate-600 mb-6 truncate px-4 text-sm">{downloadName}</p>
              
              <div className="flex flex-col gap-3">
                <a
                  href={downloadUrl}
                  download={downloadName}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors flex justify-center items-center gap-2 shadow-sm"
                >
                  <Download size={20} />
                  Download MP3
                </a>
                <button
                  onClick={handleReset}
                  className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold py-3.5 px-6 rounded-xl transition-colors flex justify-center items-center gap-2"
                >
                  <RefreshCw size={20} />
                  Convert Another
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
      
      <p className="mt-8 text-slate-400 text-sm">
        100% Secure. Files are processed entirely in your browser and never sent to a server.
      </p>
    </div>
  );
}
