const sendQueue = require('./send-queue-manager'); // module that handles queue processes
var sendWorkFn = require('./send-work-function'); // module that contains the main body of queue process definitionsons
const applog = require('../utils/debug-log'); // custom log module that can be switched off when deploying
var serialFlag = require('../utils/global-event-emitter'); // a global flag for cross-file event firing and listening
/*
  Serial header flag combinations: // to save memory, actions from the server are triggered by certain character headers from the device
  IB - Initialize Begin
  IW - Initialize Waiting
  IS - Initialize Success
  IF - Initialize Failed
  RR - Registrant Registration
  RC - Registrant Cancel
  RHELP* - Registrant HELP
  SS - Send Success
  SI - Send Initiated
  SW - Send Waiting
  SF - Send Failure
  Queue job flag combinations: // Jobs are also given flags for standardization, the types of jobs and flags used are shown below
  REQUEST:
    <None>
  // the switch flow control is found in the Arduino. Flags are listed below just for reference
  SEND: 
    F - case for appointments are full, ask client to choose a new date
    T - case for appointment registration not happening 24 hours before intended date, ask client to choose a later one
    P - case for text having the wrong format
    M - case for client being 'canceled' and moved into the reschedule table
    H - case for sending the format when client queries HELP
    X - case for permanently cancelling appointment, ask client to register again
    S - case for successful appoitnment registration, send the client appointment details
    R - case for rescheduling successful, send the client new appointment details
    C - case for sending custom message
*/
module.exports = function( data ) { // retrieves data from the arduino and starts processes based on text header
  var errors = [];
  const key = data;
  var initAttempts = 0;
  switch( key[0] ) { // handle different cases for different headers from arduino
    case 'I': // when the device initializes
      switch( key[1] ) { // determines follow up action based on second character
        case 'B': // when the device starts up
          applog.log('sender device starting up...');
          break;
        case 'W': // when the device is waiting for response from the GSM
          applog.log( 'waiting for sender device response...' );
          initAttempts ++;
          if( initAttempts > 3 ) { // abort boot and send message to system if there is no response
            // TODO: send message to system, abort boot
          }
          break;
        case 'S': // device started succesffuly
          applog.log( "the sender device started sucessfully! Send queue started..." );
          // start queue manager
          sendQueue.process({
            work_fn : sendWorkFn.work_fn, // define the function to run for the process
            concurrency : 1, // number of processes to run simultaneously, 1 means executing queue processes them one by one
            timeout : 300 // number of seconds before a queue process is aborted and considered failed
          });
          break;
        case 'F': // when the device fails
          // TODO: error handling
          break;
        default:  
      }
      break;
    case 'S': // refers to sending messages
      switch( key[1] ) {
        case 'S': // message was successfully sent
          applog.log( "message was successfully sent..." );
          serialFlag.emit( 'messageSent' , 'you managed to do it!' );
          break;
        case 'I': // GSM started sending message
          applog.log( 'warming up SIM send...' );
          break;
        case 'W': // device is waiting for the message to send
          applog.log( 'waiting for send...' );
          break;
        case 'F': // message sending failed, but most of the time it is still successfull though
          serialFlag.emit( 'messageFailed' , 'message send failed, reporting to admin...' ); // TODO : handle failed sends
          // TODO: send the message back to queue to retry, add occurence count
          break;
        default:
          errors.push( { type : 'BadPollingError' , message : 'command not recognized. please check input...' } );
      }
      break;
    default: // when there are no headers present
      errors.push( { type : 'BadPollingError' , message : 'command not recognized. please check input...' } );
  }
}