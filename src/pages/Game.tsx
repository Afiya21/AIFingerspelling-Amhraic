import { useState, useRef, useMemo, useEffect, useTransition } from "react";
import Loading from "../components/Loading";
import { FingerPoseEstimator } from "../FingerUtils/FingerPostEstimator";
import reactToDOMCursor from "../HandUtils/temp";
import { fourLetterWords } from "../data/words";
import { getLevelWords } from "../utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { HandAnalyzer } from "../HandUtils/HandAnalyzer";
import BackButton from "../components/BackButton";
import moment from "moment";
const handAnalyzer = new HandAnalyzer();
let ignore = false;
function Game() {
  const navigate = useNavigate();
  const [startTime, setStartTime] = useState<Date | undefined>();
  const [currentTime, setCurrentTime] = useState<Date | undefined>();
  const searchParams = useSearchParams();
  const [wordIndex, setWordIndex] = useState(0);
  const [hand, setHand] = useState<"left" | "right" | null>();
  const [level, setLevel] = useState<number>();
  const [levelWords, setLevelWords] = useState<Array<string>>([]);
  const [selectedWord, setSelectWord] = useState<string>();
  const [selectedLetter, setSelectedLetter] = useState<string>();
  const [wordLength, setWordLength] = useState(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [score, setScore] = useState(0);
  const videoElement = useRef(null);
  const canvasElement = useRef<HTMLCanvasElement>(null);
  let [countPrediction, setCountPrediction] = useState(0);
  useEffect(() => {
    const levelIndex = Number(searchParams[0].get("level") as String);
    setHand(searchParams[0].get("hand") as "left" | "right");
    const returnedLevelWords = getLevelWords(fourLetterWords, levelIndex);
    setLevelWords(returnedLevelWords);
    setSelectWord(returnedLevelWords[0]);
    setSelectedLetter(returnedLevelWords[0][0]);
    setLoading(true);
    setLevel(levelIndex);
  }, []);
  const handleSkip = () => {
    //level compelted go to level completed page
    if (wordIndex == 9) {
      navigate(`/level-completed?hand=${hand}&level=${level}&points=${score}`);
    }
    if (wordLength == 4 && selectedWord) {
      setSelectWord(levelWords[wordIndex + 1]);
      setSelectedLetter(selectedWord[0]);
      setWordLength(1);
      setWordIndex((prevWordIndex) => prevWordIndex + 1);
    } else if (wordLength != 4 && selectedWord) {
      setWordLength(wordLength + 1);
      setSelectedLetter(selectedWord[wordLength]);
      setWordLength(wordLength + 1);
    }
  };
  const onResults = async (results) => {
    let canvasCtx = canvasElement?.current?.getContext("2d");
    setCountPrediction(countPrediction++);
    if (countPrediction == 1) {
      setLoading(false);
    }
    canvasCtx?.save();
    canvasCtx?.clearRect(
      0,
      0,
      canvasElement.current.width,
      canvasElement.current.height
    );
    canvasCtx?.drawImage(
      results.image,
      0,
      0,
      canvasElement.current.width,
      canvasElement.current.height
    );
    if (results.multiHandLandmarks && results.multiHandedness) {
      let newLandMarks = [];
      for (const landmarks of results.multiHandLandmarks) {
        for (var i = 0; i < 21; i++) {
          let currentLandmark = landmarks[i];
          newLandMarks.push([
            currentLandmark.x,
            currentLandmark.y,
            currentLandmark.z,
          ]);
          // For Left hand we are reverting all the positions
          // if (results.multiHandedness[0].label === "Right") {
          //   newLandMarks[i][0] = newLandMarks[i][0] * -1;
          // }
          if (hand == "right") {
            newLandMarks[i][0] = newLandMarks[i][0] * -1;
          }
        }
        let fingerPoseEstimator = new FingerPoseEstimator(null);
        let fingerPoseResults = fingerPoseEstimator.estimate(newLandMarks);
        // NOTE: We are only accepting hands of a certain size - to have less false positives
        var handSize =
          handAnalyzer.findDistanceBetweenTwoLandMarks(
            newLandMarks[0],
            newLandMarks[5]
          ) * 10;
        if (handSize > 0.7) {
          drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
            color: "#ff00ff",
            lineWidth: 2,
          });
          drawLandmarks(canvasCtx, landmarks, {
            color: "transparent",
            lineWidth: 0,
          });
          if (selectedLetter && !ignore) {
            let bool =
              5 ==
              reactToDOMCursor(fingerPoseResults, newLandMarks, selectedLetter);
            if (bool) {
              ignore = true;
              setScore((prevScore) => prevScore + 1);
              handleSkip();
            }
          }
        }
      }
    }
    canvasCtx?.restore();
  };
  const hands = useMemo(() => {
    let hands = new window.Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      },
    });
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    return hands;
  }, []);
  useEffect(() => {
    if (hands) {
      setStartTime(new Date().getTime());
      hands.onResults(onResults);
    }
    if (countPrediction != 0) {
      setTimeout(() => {
        ignore = false;
      }, 1000);
    }
    setInterval(() => {
      if (startTime) {
        setCurrentTime(new Date());
      }
    }, 1000);
  }, [selectedLetter]);
  useEffect(() => {
    if (videoElement.current) {
      const camera = new window.Camera(videoElement.current, {
        onFrame: async () => {
          await hands.send({ image: videoElement.current });
        },
      });
      camera.start();
    }
  }, []);
  return (
    <div className="flex w-full">
      {loading && (
        <>
          <BackButton url={`/start-level?level=${level}&hand=${hand}`} />
          <Loading word="Loading" />
        </>
      )}

      {!loading && (
        <>
          <BackButton black url={`/select-hand?level=${level}`} />
          <div className="flex-[1] justify-between items-center p-5 bg-white flex  flex-col relative">
            <div className="absolute mr-10 text-2xl flex flex-col gap-2 w-2/3">
              <span className="font-bold text-center  text-black">
                level : {level}
              </span>
              <div className="flex absolute right-0 ">
                <p className="font-bold ">Score : {score} </p>
              </div>
              <span className="font-bold text-center  text-black">
                words : {wordIndex + 1}/10
              </span>
            </div>
            <div></div>
            <div className="flex items-center gap-10">
              <img
                draggable={false}
                src={`/spelling/${selectedLetter?.toUpperCase()}.png`}
                className="w-11/12 bg-white h-56 object-contain"
              />
              <h1 className="text-8xl text-primary">
                {selectedLetter?.toUpperCase()}
              </h1>
            </div>
            <div className="flex flex-col items-center ">
              <div className="flex">
                <h1 className="text-4xl text-primary ">
                  {selectedWord?.slice(0, wordLength - 1)}
                </h1>
                <h1 className="text-4xl ">
                  {selectedWord?.slice(wordLength - 1)}
                </h1>
              </div>
              <button
                onClick={handleSkip}
                className="btn btn-outline btn-sm round-2xl"
              >
                Skip Letter
              </button>
            </div>
          </div>
        </>
      )}
      <div className="flex-[1]  relative">
        <span className="absolute text-black font-bold text-xl m-10">
          {currentTime && startTime
            ? moment(currentTime - startTime).format("mm : ss")
            : ""}
        </span>
        <video ref={videoElement} className="input_video hidden"></video>
        <canvas
          className="output_canvas"
          style={{
            width: "100%",
            objectFit: "cover",
            height: "100vh",
            display: loading ? "none" : "block",
          }}
          ref={canvasElement}
        ></canvas>
      </div>
    </div>
  );
}
export default Game;