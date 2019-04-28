'use strict'
// Settings
var FPS_MINIMUM = 15;
var FRAM_TIMES_SIZE = 10;
var GRAVITY_CONSTANT = 0.001;
var TRACE_LENGTH_TIME = 10000;
var FRAME_TIME_MAXIMUM = 500;
var CONNECTION_DISTANCE = 100;
var DO_CONTAMINATE_COLOR = true;

// Classes
class Speed
{
	constructor(x=0, y=0)
	{
		this.dX = x;	// Pixels/ms
		this.dY = y;	// Pixels/ms
	}
}
/**
 * Returns pixels per ms.
 */
Speed.prototype.getSpeed = function()
{
	return Math.sqrt(dX*dX + dY*dY);
}
Speed.prototype.getDir = function()
{
	return Math.atan2(dX, dY);
}

class Trace
{
	constructor(start=new Position(), stop=new Position(), color=Color())
	{
		this.created = Date.now();
		this.start = new Position(start.X, start.Y);
		this.stop = new Position(stop.X, stop.Y);
		this.color = new Color(color.R, color.G, color.B, color.A);
	}
}

class Star
{
	constructor(pos=new Position())
	{
		this.pos = pos;
		this.velocity = new Speed();
		this.color = new Color(0, 0, 0);
		this.radius = 0.1;
		this.mass = 1;
	}
}
Star.prototype.mergeWith = function(secondStar)
{
	if(centerOn === secondStar)
	{
		centerOn = this;
	}

	this.radius = Math.sqrt((Math.PI*this.radius*this.radius + Math.PI*secondStar.radius*secondStar.radius)/Math.PI);

	var newMass = this.mass + secondStar.mass;
	var ratio = this.mass/newMass;
	var secondStarRatio = secondStar.mass/newMass;

	var dx = secondStar.pos.X - this.pos.X;
	var dy = secondStar.pos.Y - this.pos.Y;

	var traceStar_1 = new Trace(this.pos, undefined, this.color);
	var traceStar_2 = new Trace(secondStar.pos, undefined, secondStar.color);

	this.pos.X = this.pos.X + dx*secondStarRatio;
	this.pos.Y = this.pos.Y + dy*secondStarRatio;

	traceStar_1.stop.X = this.pos.X;
	traceStar_1.stop.Y = this.pos.Y;
	traceStar_2.stop.X = this.pos.X;
	traceStar_2.stop.Y = this.pos.Y;
	traces.push(traceStar_1);
	traces.push(traceStar_2);

	this.color.R = ratio*this.color.R + secondStarRatio*secondStar.color.R;
	this.color.G = ratio*this.color.G + secondStarRatio*secondStar.color.G;
	this.color.B = ratio*this.color.B + secondStarRatio*secondStar.color.B;
	this.color.A = ratio*this.color.A + secondStarRatio*secondStar.color.A;

	this.velocity.dX = (this.velocity.dX*this.mass + secondStar.velocity.dX*secondStar.mass) / newMass;
	this.velocity.dY = (this.velocity.dY*this.mass + secondStar.velocity.dY*secondStar.mass) / newMass;

	this.mass = newMass;

	var index = stars.indexOf(secondStar);
	if(-1 < index)
	{
		stars.splice(index, 1);
	}
}

// Global variables
var lastFrame = 0;
var stars = Array();
var traces = Array();
var artificialMass = 1;
var canvas = undefined;
var centerOn = undefined;
var maxStars = undefined;
var frameTimes = Array();
var statusWaiting = true;
var frameWidth = undefined;
var drawTraces = undefined;
var frameHeight = undefined;
var enlargeStars = undefined;
var canvasContext = undefined;
var skipAdd = FRAM_TIMES_SIZE;
var artificialStar = undefined;
var centerOnSelected = undefined;
var canvasBoundingClientRect = undefined;
var frameTimeAddStarThreshold_ms = 1000/FPS_MINIMUM;
var standardSteps = Array
(
	{
		'step': 0.5,
		'color': new Color(255, 33, 79, 255)
	},
	{
		'step': 0.0,
		'color': new Color(255, 33, 79, 255)
	},
	{
		'step': 1.0,
		'color': new Color(255, 33, 79, 255)
	}
);

// Functions
function onload()
{
	canvas = document.getElementsByTagName('canvas')[0];
	window.onresize = resize;
	window.onresize();

	canvas.addEventListener('mousedown', createGravityDrag, false);
	canvas.addEventListener('mouseup', stopGravityDrag, false);
	canvas.addEventListener('contextmenu', doCenterOnStar, false);

	canvasContext = canvas.getContext('2d');

	// Add stars
	addStars(3);

	// Fill frameTimes with no data.
	for(var i = FRAM_TIMES_SIZE; 0 < i; i--)
	{
		frameTimes.push(NaN);
	};

	// Begin animation
	inputChange();
	let timestamp = Date.now();
	(function simulationEngine(){
		if(statusWaiting){
			let now = Date.now();
			gravityStars(now - timestamp);
			timestamp = now;
		}
		setTimeout(simulationEngine, Math.max(statusWaiting ? 0 : 1, -skipAdd));
	})();
	window.requestAnimationFrame(animate);
}

function inputChange(){
	drawTraces = document.getElementById('drawTraces').checked;
	enlargeStars = document.getElementById('enlargeStars').checked;
	maxStars = parseInt(document.getElementById('maxStars').value);
	let selectedOption = document.getElementById('centerOnSelecter').selectedOptions[0].value;
	switch(selectedOption){
		case "heaviest":
		case "center":
		case "gravity":
			centerOnSelected = selectedOption;
			break;

		default:
			centerOnSelected = undefined;
			break;
	};
}

function createGravityDrag(event)
{
	if(event.button === 0)
	{
		if(0 < stars.length)
		{
			var x = event.clientX - canvasBoundingClientRect.left;
			var y = event.clientY - canvasBoundingClientRect.top;

			var closestStar = stars.sort((star_1, star_2) => getDistance(x, y, star_2.pos.X, star_2.pos.Y) < getDistance(x, y, star_1.pos.X, star_1.pos.Y))[0];
			var distance = getDistance(x, y, closestStar.pos.X, closestStar.pos.Y);
			if(distance < closestStar.radius)
			{
				artificialMass = closestStar.mass;
			}

			artificialStar = new Star(new Position(x, y));
			artificialStar.radius = 0;
			artificialStar.mass = artificialMass;

			canvas.addEventListener('mousemove', followPointer, false);
		}

		return false;
	}
}

function followPointer(innerEvent)
{
	artificialStar.pos.X = innerEvent.clientX - canvasBoundingClientRect.left;
	artificialStar.pos.Y = innerEvent.clientY - canvasBoundingClientRect.top;
}

function stopGravityDrag(event)
{
	if(event.button === 0)
	{
		event.preventDefault();
		canvas.removeEventListener('mousemove', followPointer);
		artificialStar = undefined;
		return false;
	}
}

function doCenterOnStar(event)
{
	event.preventDefault();

	if(0 < stars.length)
	{
		var x = event.clientX - canvasBoundingClientRect.left;
		var y = event.clientY - canvasBoundingClientRect.top;

		var closestStar = stars.sort((star_1, star_2) => getDistance(x, y, star_2.pos.X, star_2.pos.Y) < getDistance(x, y, star_1.pos.X, star_1.pos.Y))[0];
		var distance = getDistance(x, y, closestStar.pos.X, closestStar.pos.Y);
		centerOn = distance < closestStar.radius ? closestStar : undefined;
	}

	return false;
}

function contaminateColor()
{
	var colorAddition = Array();

	stars.forEach((star_1, index) => {
		var colorFromNearbys = new Color();
		colorAddition.push(colorFromNearbys);

		var star_1_posX = star_1.pos.X;
		var star_1_posY = star_1.pos.Y;

		stars.forEach((star_2, innerIndex) => {
			if(index !== innerIndex)
			{
				var star_2_posX = star_2.pos.X;
				var star_2_posY = star_2.pos.Y;
				var distance = getDistance(star_1_posX, star_1_posY, star_2_posX, star_2_posY);

				var size_1 = star_1.radius;
				var size_2 = star_2.radius;

				var isWithinConnectionDistance = distance < CONNECTION_DISTANCE;
	
				if(isWithinConnectionDistance)
				{
					var starColor = star_1.color;
					var nearbyColor = star_2.color;

					// TODO: Make masses count. See merge() ratio.
					var ratio = 1 - (distance / CONNECTION_DISTANCE);

					colorFromNearbys.R += (nearbyColor.R / 25.5) * ratio;
					colorFromNearbys.G += (nearbyColor.G / 25.5) * ratio;
					colorFromNearbys.B += (nearbyColor.B / 25.5) * ratio;
				}
			}
		});
	});
	
	// Subtract other colors.
	stars.forEach((star, index) => {
		var starColor = star.color;
		var addition = colorAddition[index];

		starColor.R += addition.R;
		starColor.G += addition.G;
		starColor.B += addition.B;

		var colors = [starColor.R, starColor.G, starColor.B];
		var higeColor = colors.sort((a, b) => a - b)[2];

		var diffFromMax = higeColor - 255;
		if(0 < diffFromMax)
		{
			starColor.R = starColor.R < diffFromMax ? 0 : starColor.R - diffFromMax;
			starColor.G = starColor.G < diffFromMax ? 0 : starColor.G - diffFromMax;
			starColor.B = starColor.B < diffFromMax ? 0 : starColor.B - diffFromMax;
		}
	});
}

function addStars(numberOfStars = 3)
{
	for(var index = 1; index <= numberOfStars; index++)
	{
		var newStar = getNewStar(new Position(Math.random()*frameWidth, Math.random()*frameHeight));
		newStar.color.R = Math.random()*255;
		newStar.color.G = Math.random()*255;
		newStar.color.B = Math.random()*255;
		if(centerOn != undefined){
			newStar.speed.dX += centerOn.speed.dX;
			newStar.speed.dY += centerOn.speed.dY;
		}
		stars.push(newStar);
	}
}

function resize()
{
	frameWidth = window.innerWidth;
	frameHeight = window.innerHeight;
	canvas.width = frameWidth;
	canvas.height = frameHeight;
	canvasBoundingClientRect = canvas.getBoundingClientRect();
}

function getAverageFrameTime()
{
	var sum = 0;
	frameTimes.forEach(frameTime => sum += frameTime);
	return sum/FRAM_TIMES_SIZE;
}

function animate(timespan)
{
	statusWaiting = false;
	var lastFrameTime = timespan - lastFrame;
	lastFrameTime = Math.min(lastFrameTime, FRAME_TIME_MAXIMUM);

	if(0 < lastFrameTime)
	{
		if(centerOnSelected === "heaviest" && 0 < skipAdd && 0 < stars.length){
			let heaviest = stars.sort((a, b)=>{return b.mass - a.mass})[0];
			if(centerOn == undefined){
				centerOn = heaviest;
			}
			else{
				centerOn = centerOn.mass < heaviest.mass ? heaviest : centerOn;
			}
		}
		lastFrame = timespan;

		frameTimes.push(lastFrameTime);
		var averageFrameTime = getAverageFrameTime();
		frameTimes.shift();

		if(0 < averageFrameTime)
		{
			if(skipAdd < 0 && averageFrameTime < frameTimeAddStarThreshold_ms)
			{
				skipAdd = FRAM_TIMES_SIZE;
				if(maxStars === 0 || stars.length < maxStars)
				{
					var newStar = getNewStar();
					newStar.color.R = Math.random()*255;
					newStar.color.G = Math.random()*255;
					newStar.color.B = Math.random()*255;
					stars.push(newStar);
				}
			}
			else
			{
				skipAdd--;
			}

			canvasContext.clearRect(0, 0, frameWidth, frameHeight);

			drawTrace();

			if(centerOnSelected === "center" || centerOnSelected === "gravity"){
				let totalOffset = 0;
				let artificialStar = new Star();
				let calcWithGravity = centerOnSelected === "gravity";
				stars.forEach(star => {
					let offset = calcWithGravity ? star.mass : 1;
					totalOffset += offset;
					artificialStar.pos.X += star.pos.X * offset;
					artificialStar.pos.Y += star.pos.Y * offset;
				});
				artificialStar.pos.X /= totalOffset;
				artificialStar.pos.Y /= totalOffset;
				centerOnObject(artificialStar);
			}
			else if(typeof centerOn === "object"){
				centerOnObject();
			}

			drawStars();

			if(DO_CONTAMINATE_COLOR)
			{
				contaminateColor();
			}
		}
	}

	window.requestAnimationFrame(animate);
	statusWaiting = true;
}

function centerOnObject(star=centerOn){
	var offset_X = frameWidth/2 - star.pos.X;
	var offset_Y = frameHeight/2 - star.pos.Y;

	star.pos.X = frameWidth/2;
	star.pos.Y = frameHeight/2;

	stars.forEach(localStar => {
		if(localStar !== star)
		{
			localStar.pos.X += offset_X;
			localStar.pos.Y += offset_Y;
		}
	});

	traces.forEach(trace => {
		trace.start.X += offset_X;
		trace.start.Y += offset_Y;

		trace.stop.X += offset_X;
		trace.stop.Y += offset_Y;
	});
}

function drawTrace()
{
	traces.forEach(trace => {
		if(TRACE_LENGTH_TIME < Date.now() - trace.created)
		{
			var index = traces.indexOf(trace);
			if(-1 < index)
			{
				traces.splice(index, 1);
			}
			return;
		}

		var startPos_x = trace.start.X;
		var startPos_y = trace.start.Y;
		var stopPos_x = trace.stop.X;
		var stopPos_y = trace.stop.Y;

		canvasContext.beginPath();
		var gradient = canvasContext.createLinearGradient(startPos_x, startPos_y, stopPos_x, stopPos_y);
		var colorSteps = Array
		(
			{
				'step': 0.0,
				'color': trace.color
			}
		);
		canvasContext.strokeStyle = addColorStops(gradient, colorSteps);

		var radians = Math.atan2(stopPos_y - startPos_y, stopPos_x - startPos_x);

		var dirTo_1 = radians + Math.PI/2;
		var dirTo_2 = dirTo_1 - Math.PI;

		canvasContext.moveTo(startPos_x, startPos_y);
		canvasContext.lineTo(stopPos_x, stopPos_y);
		canvasContext.stroke();
		canvasContext.closePath();
	});
}

function gravityStars(timeDuration)
{
	if(timeDuration !== 0)
	{
		var isFrameRateAcceptable = FPS_MINIMUM < 1000/timeDuration;

		stars.forEach(star => {
			if(stars.indexOf(star) === -1)
			{
				return;
			}

			var drag_x = 0;
			var drag_y = 0;

			if(artificialStar !== undefined)
			{
				var drag = calculateDrag(star, artificialStar, timeDuration);
				drag_x += drag[0];
				drag_y += drag[1];
			}

			stars.forEach(influenceStar => {
				if(star !== influenceStar)
				{
					var drag = calculateDrag(star, influenceStar, timeDuration);
					drag_x += drag[0];
					drag_y += drag[1];
				}
			});

			star.velocity.dX += drag_x;
			star.velocity.dY += drag_y;
		});

		stars.forEach(star => {
			var velocity = star.velocity;

			var pos = star.pos;
			var x = pos.X + velocity.dX*timeDuration;
			var y = pos.Y + velocity.dY*timeDuration;

			var radius = star.radius;
			var isFarLeft = x < -radius;
			var isFarRight = frameWidth + radius < x;
			var isFarDown = y < -radius;
			var isFarUp = frameHeight + radius < y;
			if(isFarLeft || isFarRight || isFarDown || isFarUp)
			{
				if(!isFrameRateAcceptable && centerOn !== star)
				{
					var index = stars.indexOf(star);
					if(-1 < index)
					{
						stars.splice(index, 1);
					}
				}
			}

			if(drawTraces){
				traces.push(new Trace(pos, new Position(x, y), star.color));
			}

			pos.X = x;
			pos.Y = y;
		});
	}
}

function calculateDrag(star, influenceStar, timeDuration)
{
	var x = 0;
	var y = 0;

	var gravityDistance_x = influenceStar.pos.X - star.pos.X;
	var gravityDistance_y = influenceStar.pos.Y - star.pos.Y;

	var gravityDistance_square = gravityDistance_x*gravityDistance_x + gravityDistance_y*gravityDistance_y;

	if(0 < influenceStar.radius && gravityDistance_square < Math.pow(star.radius + influenceStar.radius, 2))
	{
		star.mergeWith(influenceStar);
	}
	else
	{
		var gravityForce = (star.mass * influenceStar.mass * GRAVITY_CONSTANT) / gravityDistance_square;
		var gravityAcceleration = gravityForce / star.mass;

		var gravityDir = Math.atan2(gravityDistance_x, gravityDistance_y);
		var distanceTraveled = gravityAcceleration * timeDuration;

		distanceTraveled = distanceTraveled < 0.01 ? distanceTraveled : 0.01;

		x = Math.sin(gravityDir) * distanceTraveled;
		y = Math.cos(gravityDir) * distanceTraveled;
	}

	return [x, y];
}

function getDistance(x1, y1, x2, y2)
{
	return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function getNewStar(position, dir, speed=GRAVITY_CONSTANT)
{
	if(dir === undefined)
	{
		dir = Math.random()*2*Math.PI;
	}

	var star = new Star(position);
	star.velocity.dX = speed*Math.sin(dir);
	star.velocity.dY = speed*Math.cos(dir);

	if(false && centerOn !== undefined)
	{
		star.velocity.dX += centerOn.velocity.dX;
		star.velocity.dY += centerOn.velocity.dY;
	}

	if(position === undefined)
	{
		dir += Math.PI;
		var sin = Math.sin(dir);
		var cos = Math.cos(dir);
		var radius = star.radius;

		var isSinMajor = Math.max(Math.abs(sin), Math.abs(cos)) === Math.abs(sin);
		if(isSinMajor)	// Left or Right
		{
			var x = sin < 0 ? 1-radius : frameWidth+radius-1;
			var y = Math.random()*frameHeight;
			star.pos = new Position(x, y);
		}
		else
		{
			var x = Math.random()*frameWidth;
			var y = cos < 0 ? 1-radius : frameHeight+radius-1;
			star.pos = new Position(x, y);
		}
	}

	return star;
}

function drawStars()
{
	stars.forEach(star => {
		canvasContext.beginPath();
		canvasContext.strokeStyle = 'White';
		canvasContext.arc(star.pos.X, star.pos.Y, enlargeStars ? (star.radius < 3 ? 3 : star.radius) : star.radius, 0, 2*Math.PI);
		canvasContext.fillStyle = star.color.toString();
		canvasContext.fill();
		canvasContext.stroke();
		canvasContext.closePath();
	});
}

function addColorStops(gradient, colorStepArray)
{
	colorStepArray.forEach(colorStep => gradient.addColorStop('' + colorStep.step, colorStep.color.toString()));
	return gradient;
}