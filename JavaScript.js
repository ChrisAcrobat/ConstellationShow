'use strict'
const worker = new Worker('worker.js');
const frameTimes = [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
const traces = [];
let _canvas;
let _drawTraces;
let _enlargeStars;
let _maxStars;
let _gravityConstant;
let _centerOn;
let _frameTime;
let _frameTimeMaxTarget;
let _doColorContamination;
let _lastState = [];
class Trace{
	constructor(star){
		this.created = Date.now();
		this.starId = star.id;
		this.start = star.old.pos;
		this.stop = star.pos;
		this.color = star.color;
	}
}
function onload(){
	_canvas = document.getElementsByTagName('canvas')[0];
	const canvasContext = _canvas.getContext('2d');
	const frameTime = document.getElementById('frameTime');
	const numberOfStars = document.getElementById('numberOfStars');
	const traceLengthSeconds = document.getElementById('traceLengthSeconds');

	window.onresize = resize;
	window.onresize();
	inputChange();

	worker.onmessage = state => {
		const renderStart = Date.now();
		const stars = state.data.stars;
		const offset = state.data.offset;
		const centerOn = state.data.centerOn;
		numberOfStars.innerHTML = stars.length;
		canvasContext.clearRect(0, 0, window.innerWidth, window.innerHeight);
		stars.forEach(star => {
			canvasContext.beginPath();
			canvasContext.strokeStyle = 'White';
			canvasContext.arc(star.pos.x, star.pos.y, _enlargeStars ? (star.radius < 3 ? 3 : star.radius) : star.radius, 0, 2*Math.PI);
			canvasContext.fillStyle = star.color.toString();
			canvasContext.fill();
			canvasContext.stroke();
			canvasContext.closePath();

			do{
				star.old = _lastState.shift();
			}while(star.old && star.old.id !== star.id);

			if(drawTraces && star.old){
				traces.push(new Trace(star));
			}
		});
		if(_drawTraces){
			const time = traceLengthSeconds.valueAsNumber*1000;
			const now = Date.now();
			traces.forEach(trace => {
				if(time < now - trace.created || trace.starId == centerOn?.id){
					const index = traces.indexOf(trace);
					if(-1 < index){
						traces.splice(index, 1);
					}
					return;
				}

			//	trace.start.x -= offset.x;
			//	trace.start.y -= offset.y;
			//	trace.stop.x -= offset.x;
			//	trace.stop.y -= offset.y;
				if(centerOn){
					trace.start.x -= centerOn.speed.dx;
					trace.start.y -= centerOn.speed.dy;
					trace.stop.x -= centerOn.speed.dx;
					trace.stop.y -= centerOn.speed.dy;
				}
		
				canvasContext.beginPath();
				const gradient = canvasContext.createLinearGradient(trace.start.x, trace.start.y, trace.stop.x, trace.stop.y);
				const colorSteps = [{'step': 0.0, 'color': trace.color}];
				canvasContext.strokeStyle = addColorStops(gradient, colorSteps);
		
				canvasContext.moveTo(trace.start.x, trace.start.y);
				canvasContext.lineTo(trace.stop.x, trace.stop.y);
				canvasContext.stroke();
				canvasContext.closePath();
			});
		}else{
			traces.splice(0, traces.length);
		}
		_lastState = stars;
		window.requestAnimationFrame(requestUpdate);
		frameTimes.push(Date.now() - renderStart);
		frameTimes.shift();
		_frameTime = getAverage(frameTimes);
		frameTime.innerHTML = `${_frameTime} ms (~ ${Math.round(1000/_frameTime)} fps)`;
	}
	window.requestAnimationFrame(requestUpdate);
}
function addColorStops(gradient, colorStepArray){
	colorStepArray.forEach(colorStep => gradient.addColorStop(''+colorStep.step, colorStep.color));
	return gradient;
}
function inputChange(){
	_drawTraces = document.getElementById('drawTraces').checked;
	_enlargeStars = document.getElementById('enlargeStars').checked;
	_doColorContamination = document.getElementById('doColorContamination').checked;
	_centerOn = document.getElementById('centerOnSelector').selectedOptions[0].value;
	_maxStars = document.getElementById('maxStars').valueAsNumber;
	_gravityConstant = document.getElementById('gravityConstant').valueAsNumber;
	_frameTimeMaxTarget = document.getElementById('frameTimeMaxTarget').valueAsNumber;
}
function getAverage(array){
	let sum = 0;
	array.forEach(number => sum += number);
	return sum/array.length;
}
function resize(){
	_canvas.width = window.innerWidth;
	_canvas.height = window.innerHeight;
}
function requestUpdate(){
	worker.postMessage({
		settings: {
			width: window.innerWidth,
			height: window.innerHeight,
			maxStars: _maxStars,
			gravityConstant: _gravityConstant,
			frameTimeAcceptable: _frameTime < _frameTimeMaxTarget,
			doColorContamination: _doColorContamination,
			centerOn: _centerOn
		}
	});
}
