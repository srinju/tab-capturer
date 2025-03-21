let recorder = null;
let recordedChunks = [];
let stream = null;
let mediaRecorder = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startRecording") {
    startRecording(message.examId)
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error("Error starting recording:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required to use sendResponse asynchronously
  } 
  else if (message.action === "stopRecording") {
    stopRecording(message.examId)
      .then(videoBlob => {
        uploadRecording(videoBlob, message.examId)
          .then(fileUrl => {
            sendResponse({ success: true, fileUrl });
          })
          .catch(error => {
            console.error("Error uploading recording:", error);
            sendResponse({ success: false, error: error.message });
          });
      })
      .catch(error => {
        console.error("Error stopping recording:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required to use sendResponse asynchronously
  }
});

async function startRecording(examId) {
  try {
    if (recorder) {
      // Already recording
      return;
    }

    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Start screen capture
    stream = await chrome.tabCapture.capture({
      video: true,
      audio: true,
      videoConstraints: {
        mandatory: {
          minWidth: 1280,
          minHeight: 720,
          maxWidth: 1920,
          maxHeight: 1080,
          maxFrameRate: 30
        }
      }
    });
    
    if (!stream) {
      throw new Error("Failed to start tab capture");
    }

    // Create MediaRecorder
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9"
    });

    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.start(1000); // Collect data every second
    
    // Store the recording state
    chrome.storage.local.set({ 
      isRecording: true,
      recordingExamId: examId,
      recordingStartTime: Date.now() 
    });

    // Notify content script that recording has started
    chrome.tabs.sendMessage(tab.id, { action: "recordingStarted" });
    
    console.log("Recording started for exam:", examId);
  } catch (error) {
    console.error("Failed to start recording:", error);
    throw error;
  }
}

async function stopRecording(examId) {
  return new Promise((resolve, reject) => {
    try {
      if (!mediaRecorder || !stream) {
        reject(new Error("No active recording found"));
        return;
      }

      // Set up a handler for when media recorder stops
      mediaRecorder.onstop = () => {
        // Create a video blob from the recorded chunks
        const videoBlob = new Blob(recordedChunks, { type: "video/webm" });
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        mediaRecorder = null;
        recordedChunks = [];
        
        // Update storage
        chrome.storage.local.set({ 
          isRecording: false,
          recordingExamId: null 
        });
        
        console.log("Recording stopped, blob size:", videoBlob.size);
        resolve(videoBlob);
      };

      // Stop the media recorder if it's recording
      if (mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      } else {
        reject(new Error("MediaRecorder is not active"));
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
      reject(error);
    }
  });
}

async function uploadRecording(videoBlob, examId) {
  try {
    console.log("Uploading recording, blob size:", videoBlob.size);
    
    // Create a FormData object to send the file
    const formData = new FormData();
    const fileName = `recording-${examId}-${Date.now()}.webm`;
    formData.append("file", videoBlob, fileName);
    formData.append("examId", examId);
    formData.append("type", "recording");
    
    // Get the API endpoint from your app domain
    const uploadUrl = "https://your-domain.com/api/upload";
    
    // Upload the recording
    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("Upload successful, URL:", data.fileUrl);
    
    // Notify content script that upload is complete
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { 
      action: "uploadComplete", 
      fileUrl: data.fileUrl 
    });
    
    return data.fileUrl;
  } catch (error) {
    console.error("Error uploading recording:", error);
    throw error;
  }
}