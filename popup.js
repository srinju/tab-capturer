document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('status');
    const examInfoEl = document.getElementById('examInfo');
    const stopBtn = document.getElementById('stopBtn');
  
    // Check recording status
    chrome.storage.local.get(['isRecording', 'recordingExamId', 'recordingStartTime'], (data) => {
      if (data.isRecording) {
        const duration = Math.floor((Date.now() - data.recordingStartTime) / 1000);
        statusEl.textContent = `Status: Recording`;
        statusEl.className = 'status recording';
        examInfoEl.textContent = `Exam ID: ${data.recordingExamId}
  Duration: ${formatDuration(duration)}`;
        stopBtn.disabled = false;
      } else {
        statusEl.textContent = 'Status: Idle';
        statusEl.className = 'status idle';
        examInfoEl.textContent = 'No active recording';
        stopBtn.disabled = true;
      }
    });
  
    // Update timer if recording
    let timerInterval;
    chrome.storage.local.get(['isRecording', 'recordingStartTime'], (data) => {
      if (data.isRecording) {
        const startTime = data.recordingStartTime;
        timerInterval = setInterval(() => {
          const duration = Math.floor((Date.now() - startTime) / 1000);
          examInfoEl.textContent = `Exam ID: ${data.recordingExamId}
  Duration: ${formatDuration(duration)}`;
        }, 1000);
      }
    });
  
    // Stop recording when button is clicked
    stopBtn.addEventListener('click', () => {
      chrome.storage.local.get(['recordingExamId'], (data) => {
        chrome.runtime.sendMessage(
          { action: 'stopRecording', examId: data.recordingExamId },
          (response) => {
            if (response.success) {
              statusEl.textContent = 'Status: Idle';
              statusEl.className = 'status idle';
              examInfoEl.textContent = 'Recording stopped and uploaded';
              stopBtn.disabled = true;
              clearInterval(timerInterval);
            } else {
              examInfoEl.textContent = `Error: ${response.error}`;
            }
          }
        );
      });
    });
  
    // Format duration as mm:ss
    function formatDuration(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  });