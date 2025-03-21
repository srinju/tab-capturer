// Listen for messages from the web page
window.addEventListener('message', (event) => {
    // Make sure message is from our application
    if (event.source !== window || !event.data.type) {
      return;
    }
  
    if (event.data.type === 'START_RECORDING') {
      chrome.runtime.sendMessage(
        { action: 'startRecording', examId: event.data.examId },
        (response) => {
          window.postMessage(
            { type: 'RECORDING_STARTED', success: response.success },
            '*'
          );
        }
      );
    } else if (event.data.type === 'STOP_RECORDING') {
      chrome.runtime.sendMessage(
        { action: 'stopRecording', examId: event.data.examId },
        (response) => {
          window.postMessage(
            { 
              type: 'RECORDING_STOPPED', 
              success: response.success, 
              fileUrl: response.fileUrl 
            },
            '*'
          );
        }
      );
    }
  });
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'recordingStarted') {
      window.postMessage({ type: 'RECORDING_STARTED', success: true }, '*');
    } else if (message.action === 'uploadComplete') {
      window.postMessage(
        { 
          type: 'UPLOAD_COMPLETE', 
          fileUrl: message.fileUrl 
        },
        '*'
      );
    }
  });
  
  // Let the page know extension is available
  window.postMessage({ type: 'RECORDER_EXTENSION_READY' }, '*');