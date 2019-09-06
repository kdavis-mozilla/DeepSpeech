'use strict';

const binary = require('node-pre-gyp');
const path = require('path')
// 'lib', 'binding', 'v0.1.1', ['node', 'v' + process.versions.modules, process.platform, process.arch].join('-'), 'deepspeech-bingings.node')
const binding_path = binary.find(path.resolve(path.join(__dirname, 'package.json')));

// On Windows, we can't rely on RPATH being set to $ORIGIN/../ or on
// @loader_path/../ but we can change the PATH to include the proper directory
// for the dynamic linker
if (process.platform === 'win32') {
  const dslib_path = path.resolve(path.join(binding_path, '../..'));
  var oldPath = process.env.PATH;
  process.env['PATH'] = `${dslib_path};${process.env.PATH}`;
}

const binding = require(binding_path);

if (process.platform === 'win32') {
  process.env['PATH'] = oldPath;
}

/**
 * @class
 * An object providing an interface to a trained DeepSpeech model.
 *
 * @param {string} aModelPath The path to the frozen model graph.
 * @param {number} aNCep The number of cepstrum the model was trained with.
 * @param {number} aNContext The context window the model was trained with.
 * @param {string} aAlphabetConfigPath The path to the configuration file specifying the alphabet used by the network. See alphabet.h.
 * @param {number} aBeamWidth The beam width used by the decoder. A larger beam width generates better results at the cost of decoding time.
 *
 * @throws on error
 */
function Model() {
    this._impl = null;

    const rets = binding.CreateModel.apply(null, arguments);
    const status = rets[0];
    const impl = rets[1];
    if (status !== 0) {
        throw "CreateModel failed with error code " + status;
    }

    this._impl = impl;
}

/**
 * Enable decoding using beam scoring with a KenLM language model.
 *
 * @param {string} aAlphabetConfigPath The path to the configuration file specifying the alphabet used by the network. See alphabet.h.
 * @param {string} aLMPath The path to the language model binary file.
 * @param {string} aTriePath The path to the trie file build from the same vocabulary as the language model binary.
 * @param {float} aLMAlpha The alpha hyperparameter of the CTC decoder. Language Model weight.
 * @param {float} aLMBeta The beta hyperparameter of the CTC decoder. Word insertion weight.
 *
 * @return {number} Zero on success, non-zero on failure (invalid arguments).
 */
Model.prototype.enableDecoderWithLM = function() {
    const args = [this._impl].concat(Array.prototype.slice.call(arguments));
    return binding.EnableDecoderWithLM.apply(null, args);
}

/**
 * Use the DeepSpeech model to perform Speech-To-Text.
 *
 * @param {object} aBuffer A 16-bit, mono raw audio signal at the appropriate sample rate.
 * @param {number} aBufferSize The number of samples in the audio signal.
 * @param {number} aSampleRate The sample-rate of the audio signal.
 *
 * @return {string} The STT result. Returns undefined on error.
 */
Model.prototype.stt = function() {
    const args = [this._impl].concat(Array.prototype.slice.call(arguments));
    return binding.SpeechToText.apply(null, args);
}

/**
 * Use the DeepSpeech model to perform Speech-To-Text and output metadata
 * about the results.
 *
 * @param {object} aBuffer A 16-bit, mono raw audio signal at the appropriate sample rate.
 * @param {number} aBufferSize The number of samples in the audio signal.
 * @param {number} aSampleRate The sample-rate of the audio signal.
 *
 * @return {object} Outputs a struct of individual letters along with their timing information. The user is responsible for freeing Metadata by calling :js:func:`FreeMetadata`. Returns undefined on error.
 */
Model.prototype.sttWithMetadata = function() {
    const args = [this._impl].concat(Array.prototype.slice.call(arguments));
    return binding.SpeechToTextWithMetadata.apply(null, args);
}

/**
 * Create a new streaming inference state. The streaming state returned by this function can then be passed to :js:func:`feedAudioContent` and :js:func:`finishStream`.
 *
 * @param {number} aSampleRate The sample-rate of the audio signal.
 * @return {object} an opaque object that represents the streaming state.
 *
 * @throws on error
 */
Model.prototype.setupStream = function() {
    const args = [this._impl].concat(Array.prototype.slice.call(arguments));
    const rets = binding.SetupStream.apply(null, args);
    const status = rets[0];
    const ctx = rets[1];
    if (status !== 0) {
        throw "SetupStream failed with error code " + status;
    }
    return ctx;
}

/**
 * Feed audio samples to an ongoing streaming inference.
 *
 * @param {object} aSctx A streaming state returned by :js:func:`setupStream`.
 * @param {buffer} aBuffer An array of 16-bit, mono raw audio samples at the
 *                 appropriate sample rate.
 * @param {number} aBufferSize The number of samples in @param aBuffer.
 */
Model.prototype.feedAudioContent = function() {
    binding.FeedAudioContent.apply(null, arguments);
}

/**
 * Compute the intermediate decoding of an ongoing streaming inference. This is an expensive process as the decoder implementation isn't currently capable of streaming, so it always starts from the beginning of the audio.
 *
 * @param {object} aSctx A streaming state returned by :js:func:`setupStream`.
 *
 * @return {string} The STT intermediate result.
 */
Model.prototype.intermediateDecode = function() {
    return binding.IntermediateDecode.apply(null, arguments);
}

/**
 * Signal the end of an audio signal to an ongoing streaming inference, returns the STT result over the whole audio signal.
 *
 * @param {object} aSctx A streaming state returned by :js:func:`setupStream`.
 *
 * @return {string} The STT result.
 *
 * This method will free the state (@param aSctx).
 */
Model.prototype.finishStream = function() {
    return binding.FinishStream.apply(null, arguments);
}

/**
 * Signal the end of an audio signal to an ongoing streaming inference, returns per-letter metadata.
 *
 * @param {object} aSctx A streaming state pointer returned by :js:func:`setupStream`.
 *
 * @return {object} Outputs a struct of individual letters along with their timing information. The user is responsible for freeing Metadata by calling :js:func:`FreeMetadata`.
 *
 * This method will free the state pointer (@param aSctx).
 */
Model.prototype.finishStreamWithMetadata = function() {
    return binding.FinishStreamWithMetadata.apply(null, arguments);
}

/**
 * Frees associated resources and destroys model object.
 *
 * @param {object} model A model pointer returned by :js:func:`Model`
 *
 */
function DestroyModel(model) {
    return binding.DestroyModel(model._impl);
}

/**
 * Free memory allocated for metadata information.
 *
 * @param {Object} metadata Object containing metadata as returned by :js:func:`sttWithMetadata` or :js:func:`finishStreamWithMetadata`
 */
function FreeMetadata(metadata) {
    return binding.FreeMetadata(metadata);
}

/**
 * Print version of this library and of the linked TensorFlow library on standard output.
 */
function printVersions() {
    return binding.PrintVersions();
}

module.exports = {
    Model: Model,
    printVersions: printVersions,
    DestroyModel: DestroyModel,
    FreeMetadata: FreeMetadata
};
