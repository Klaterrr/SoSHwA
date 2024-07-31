/*
 * To-Do list:
 *  1.   Integration with telebot - complete;
 *  2.   Realisation of NLP - complete;
 *  2,5. Fetch telegram audios and download it - in list;
 *  3.   Realisation of Speech recognition - in list;
 *  4.   Complete the nonRDB - in list;
 *  5.   Complete all a functions on .cpp and integrate it with .sh to launch with njs - in list.
 *
 */


require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');           // Library for telegram bot 
const OpenAI = require('openai-api');                           // OpenAI library
const Recorder = require('node-record-lpcm16');                 // For microphone stream data
const Speech = require('@google-cloud/speech');                 // Google STT Library
const FileSystem = require('fs');                               // Library for system operations
const CurrentConfigPath = `./config.json`;                      // Path to the configuration file
const CurrentConfig = require(CurrentConfigPath);               // Configuration file
const Request = require('request');                             // 
const Https = require('https');
const Fetch = require('node-fetch');                            // To fetch and scrap web pages
//const NativeExtension = require('bindings')('NativeExtension'); // Include cpp-files
const Token = process.env.TOKEN;
const Homey = new TelegramBot(Token, { polling: true });
const Openai = new OpenAI(process.env.OPENAI_TOKEN);
const Client = new Speech.SpeechClient();

const RecognizeStream = Client
  .streamingRecognize({
    encoding: CurrentConfig.SpeechSettings.Encoding,
    sampleRateHerz: CurrentConfig.SpeechSettings.SampleRateHerz,
    languageCode: CurrentConfig.SpeechSettings.LanguageCode,
    interimResults: CurrentConfig.SpeechSettings.InterimResults
  })
  .on('error', console.error)
  .on('data', data =>
    process.stdout.write(
      data.results[0] && data.results[0].alternatives[0]
        ? `Transcription: ${data.results[0].alternatives[0].transcript}\n`
        : '\n\nReached transcription time limit, press Ctrl+C\n'
    )
  );

// Function to create new OpenAI request 
function CreateOpenAIRequest(EngineName, Prompt, TokenNum, Temperature, StopSigns) {
  return Openai.complete({
    engine: EngineName,
    prompt: Prompt,
    maxTokens: TokenNum,
    temperature: Temperature,
    topP: 0.3,
    presencePenalty: 0,
    frequencyPenalty: 0.5,
    bestOf: 1,
    n: 1,
    stream: false,
    stop: StopSigns
  });
}

function GetPersonName(FirstName, LastName, UserName) {
  if (FirstName === undefined) return UserName;
  else if (LastName === undefined) return FirstName;
  else return `${FirstName} ${LastName}`;
}

function RecordVoiceStream() {
  Recorder
    .record({
      sampleRateHertz: CurrentConfig.SpeechSettings.SampleRateHerz,
      threshold: CurrentConfig.SpeechSettings.Threshold,
      recordProgram: CurrentConfig.SpeechSettings.RecordProgram,
      silence: CurrentConfig.SpeechSettings.Silence,
    })
    .stream()
    .on('error', console.error)
    .pipe(RecognizeStream);
}

function SpeechRecognise(AudioRequest) {
  CurrentConfig.SpeechSettings.EncodingTypeNum = 1;
  
  const [Response] = Client.recognize(AudioRequest);
  const Transcription = Response.results
    .map(result => result.alternatives[0].transcript)
    .join('\n');
  console.log(`Transcription: ${Transcription}`);
}

function WriteFS(DirrectionToTheFile, Text) {
  FileSystem.writeFile(`./${DirrectionToTheFile}`, `${Text}`, function(Error) {
    if (Error) throw Error;
    console.log('Updated!');
  });
}

let PromptMain = `${process.env.PROMPT_MAIN}`;

Homey.on('message', message => {
  console.log(message);
  let Name = GetPersonName(message.from.first_name, message.from.second_name, message.from.username);
  if (message.voice) {
    console.log("Current message is voice~");
    // console.log(Homey.getFile(message.voice.file_id));
    /*
    FileSystem.writeFile(`./files/audio/${CurrentConfig.SpeechSettings.LastAudioFileID}.ogg`, 
                         BotName.getFile(message.voice.file_id), 
                         function writeJSON(Error) {
      if (Error) return console.log(Error);
      CurrentConfig.SpeechSettings.LastAudioFileID += 1;
      FileSystem.writeFile(`./config.json`, JSON.stringify(CurrentConfig) );
      console.log(`Succesfully created ./files/audio/${message.voice.file_unique_id}.ogg`);
    });
    */

    Fetch(`https://api.telegram.org/bot${Token}/getFile?file_id=${message.voice.file_id}`)
      .then((Response) => Response.json())
      .then((Json) => {
        const FilePath = Json.result.file_path;
        const DownloadLink = `https://api.telegram.org/file/bot${process.env.TOKEN}/${FilePath}`;
        console.log(Json+'\n'+DownloadLink);
        Https.get(DownloadLink, (NewResponse) => {
          const Path = (`${__dirname}/files/audio/${CurrentConfig.SpeechSettings.LastAudioFileID}.oga`);
          const FilePath = FileSystem.createWriteStream(Path);
          NewResponse.pipe(FilePath);
          FilePath.on('finish', () => {
            FilePath.close();
            CurrentConfig.SpeechSettings.LastAudioFileID += 1;
            WriteFS(CurrentConfigPath, JSON.stringify(CurrentConfig));
            console.log('Done!');
          })
        });
      }).catch((Error) => {
        console.log(Error)
      });
  } else if ((message.chat.type == "private")) {
    PromptMain += `${Name}:\n${message.text}\n_\nHomey:\n`;
    console.log(`${Name}:\n${message.text}\n\n`);
    (async () => {
      const GPTResponse = await CreateOpenAIRequest(CurrentConfig.NLPSettings.EngineName, PromptMain,
        256, CurrentConfig.NLPSettings.Temperature, ['\n\n\n', '\n_']);
      Homey.sendMessage(message.chat.id, `${GPTResponse.data.choices[0].text}\n`);
      PromptMain += `${GPTResponse.data.choices[0].text}\n_\n`;
      console.log(`Homey:\n${GPTResponse.data.choices[0].text}\n`)
    })();
  }
})

Homey.on('polling_error', console.log);
