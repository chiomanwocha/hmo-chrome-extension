var recorder = null;
var chunkCounter = 1; // Initialize the chunk counter

function sendChunkToServer(chunkBlob, chunkNumber, videoId) {
  // Create a FormData object and append the chunk with the key "video"
  const formData = new FormData();
  formData.append("video", chunkBlob, `chunk_${chunkNumber}.mp4`);

  // Replace with the URL of your server endpoint for each chunk
  const endpointURL = `http://tavish-chrome.onrender.com/update/${videoId}/${chunkNumber}`;

  const xhr = new XMLHttpRequest();
  xhr.open("PUT", endpointURL, true);

  // Define a callback function to handle the response
  xhr.onload = function () {
    if (xhr.status === 200) {
      console.log(`Chunk ${chunkNumber} successfully uploaded to the server.`);
    } else {
      console.log(
        `Failed to upload chunk ${chunkNumber}. Server returned status: ${xhr.status}`
      );
    }
  };

  // Send the FormData object with the chunk
  xhr.send(formData);
}

function startChunking(videoId) {
  const chunkSize = 10 * 1000; // 10 seconds in milliseconds

  // Check if there is an active recorder
  if (recorder && recorder.state === "recording") {
    const chunkInterval = setInterval(() => {
      if (recorder && recorder.state === "recording") {
        recorder.requestData(); // Request data for the next chunk
      } else {
        clearInterval(chunkInterval);
      }
    }, 3000); // Send chunks every three seconds

    recorder.ondataavailable = function (event) {
      sendChunkToServer(event.data, chunkCounter, videoId);
      chunkCounter++;
    };

    recorder.onstop = function () {
      alert("Uploading...");
      completeRecording(videoId)
    };
  }
}

function completeRecording(videoId) {
  fetch(`http://tavish-chrome.onrender.com/complete/${videoId}`, {
    method: "PUT",
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json(); // Parse the response as JSON
    })
    .then(() => {
      // On success, open the details page in a new tab
      alert("You will be redirected shortly");
      window.open(
        `https://hmo-frontend.vercel.app/recording-details/${videoId}`,
        "_blank"
      );
    })
    .catch((error) => {
      alert("Recording completion was not successful, but you will be redirected anyway.");
      window.open(
        `https://hmo-frontend.vercel.app/recording-details/${videoId}`,
        "_blank"
      );
    });
}


function onAccessApproved(stream) {
  recorder = new MediaRecorder(stream);

  recorder.start();
  let videoId = null;
  fetch("https://tavish-chrome.onrender.com/create", {
    method: "POST",
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json(); // Parse the response as JSON
    })
    .then((data) => {
      console.log("Response data:", data);
      if (data.id) {
        // Save the ID for later use
        videoId = data.id;

        // Start chunking the video after a delay (e.g., 10 seconds)
        setTimeout(startChunking(videoId), 10000); // Adjust the delay as needed
      } else {
        showMessage("No ID received from the server");
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      // Handle any errors that occurred during the request
    });

  // Add an event listener for the recorder's stop event
  recorder.onstop = function () {
    completeRecording(videoId); // Call the function to complete the recording
  };

  // Start chunking the video immediately
  startChunking(videoId);
  alert('Recording has started!')
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "request_recording") {
    sendResponse(`processed: ${message.action}`);

    navigator.mediaDevices
      .getDisplayMedia({
        audio: true,
        video: {
          width: 9999999999,
          height: 9999999999,
        },
      })
      .then((stream) => {
        onAccessApproved(stream);
      });
  }

  if (message.action === "stopvideo") {
    console.log("Recording stopped");
    sendResponse(`processed: ${message.action}`);
    if (!recorder) {
      console.log("No recorder");
      return;
    }

    recorder.stop();
  }
});
