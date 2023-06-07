'use strict'
importScripts('https://chrisacrobat.github.io/js-compilation/Color.js', 'https://chrisacrobat.github.io/js-compilation/Position.js');

// Settings
const engineTimes = [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
const engineTimeMinTarget = 15;
const engineTimeThreshold_ms = 1000/engineTimeMinTarget;
const connectionDistance = 100;
const stars = Array();
const standardSteps = [
	{
		'step': 0.5,
		'color': new Color(255, 33, 79, 255)
	},{
		'step': 0.0,
		'color': new Color(255, 33, 79, 255)
	},{
		'step': 1.0,
		'color': new Color(255, 33, 79, 255)
	}
];
let _queue = Promise.resolve();
let _skipAdd = engineTimes.length;
let _settings;
let _centerOn;
class Speed{
	constructor(x=0, y=0)
	{
		this.dX = x;	// Pixels/ms
		this.dY = y;	// Pixels/ms
	}
	getSpeed(){
		return Math.sqrt(dX*dX + dY*dY);
	}
	/** Returns pixels per ms. */
	getSpeed(){
		return Math.sqrt(dX*dX + dY*dY);
	}
	getDir(){
		return Math.atan2(dX, dY);
	}
}
class Star{
	static #nextID = 0;
	#id;
	constructor(pos=new Position()){
		this.#id = Star.#nextID++;
		this.pos = pos;
		this.velocity = new Speed();
		this.color = new Color(0, 0, 0);
		this.radius = 0.1;
		this.mass = 1;
	}
	mergeWith(secondStar) {
		if(_centerOn === secondStar){
			_centerOn = this;
		}
	
		this.radius = Math.sqrt((Math.PI*this.radius*this.radius + Math.PI*secondStar.radius*secondStar.radius)/Math.PI);
	
		const newMass = this.mass + secondStar.mass;
		const ratio = this.mass/newMass;
		const secondStarRatio = secondStar.mass/newMass;
	
		const dx = secondStar.pos.X - this.pos.X;
		const dy = secondStar.pos.Y - this.pos.Y;
	
		this.pos.X = this.pos.X + dx*secondStarRatio;
		this.pos.Y = this.pos.Y + dy*secondStarRatio;
	
		this.color.R = ratio*this.color.R + secondStarRatio*secondStar.color.R;
		this.color.G = ratio*this.color.G + secondStarRatio*secondStar.color.G;
		this.color.B = ratio*this.color.B + secondStarRatio*secondStar.color.B;
		this.color.A = ratio*this.color.A + secondStarRatio*secondStar.color.A;
	
		this.velocity.dX = (this.velocity.dX*this.mass + secondStar.velocity.dX*secondStar.mass) / newMass;
		this.velocity.dY = (this.velocity.dY*this.mass + secondStar.velocity.dY*secondStar.mass) / newMass;
	
		this.mass = newMass;
	
		const index = stars.indexOf(secondStar);
		if(-1 < index){
			stars.splice(index, 1);
		}
	}
	parse(speed=false){
		const data = {
			id: this.#id,
			color: this.color.toString(),
			pos: {
				x: this.pos.X,
				y: this.pos.Y
			},
			radius: this.radius
		};
		if(speed){
			data.speed = {
				dx: this.velocity.dX,
				dy: this.velocity.dY
			};
		}
		return data;
	}
}
function contaminateColor(){
	const colorAddition = Array();

	stars.forEach((star_1, index) => {
		const colorFromNearbys = new Color();
		colorAddition.push(colorFromNearbys);

		const star_1_posX = star_1.pos.X;
		const star_1_posY = star_1.pos.Y;

		stars.forEach((star_2, innerIndex) => {
			if(index !== innerIndex){
				const star_2_posX = star_2.pos.X;
				const star_2_posY = star_2.pos.Y;
				const distance = getDistance(star_1_posX, star_1_posY, star_2_posX, star_2_posY);

				const size_1 = star_1.radius;
				const size_2 = star_2.radius;

				const isWithinConnectionDistance = distance < connectionDistance;
	
				if(isWithinConnectionDistance){
					const starColor = star_1.color;
					const nearbyColor = star_2.color;

					const ratio = 1 - (distance / connectionDistance);

					colorFromNearbys.R += (nearbyColor.R / 25.5) * ratio;
					colorFromNearbys.G += (nearbyColor.G / 25.5) * ratio;
					colorFromNearbys.B += (nearbyColor.B / 25.5) * ratio;
				}
			}
		});
	});
	
	// Subtract other colors.
	stars.forEach((star, index) => {
		const starColor = star.color;
		const addition = colorAddition[index];

		starColor.R += addition.R;
		starColor.G += addition.G;
		starColor.B += addition.B;

		const colors = [starColor.R, starColor.G, starColor.B];
		const higeColor = colors.sort((a, b) => a - b)[2];

		const diffFromMax = higeColor - 255;
		if(0 < diffFromMax){
			starColor.R = starColor.R < diffFromMax ? 0 : starColor.R - diffFromMax;
			starColor.G = starColor.G < diffFromMax ? 0 : starColor.G - diffFromMax;
			starColor.B = starColor.B < diffFromMax ? 0 : starColor.B - diffFromMax;
		}
	});
}
function addStars(numberOfStars = 3){
	for(let index = 1; index <= numberOfStars; index++){
		const newStar = getNewStar(new Position(Math.random()*_settings.width, Math.random()*_settings.height));
		newStar.color.R = Math.random()*255;
		newStar.color.G = Math.random()*255;
		newStar.color.B = Math.random()*255;
		if(_centerOn){
			newStar.speed.dX += _centerOn.speed.dX;
			newStar.speed.dY += _centerOn.speed.dY;
		}
		stars.push(newStar);
	}
}
function getAverage(array){
	let sum = 0;
	array.forEach(number => sum += number);
	return sum/array.length;
}
let _lastOffset = {x:0,y:0};
function centerOnObject(star=_centerOn){
	const x = _settings.width/2 - star.pos.X;
	const y = _settings.height/2 - star.pos.Y;

	star.pos.X = _settings.width/2;
	star.pos.Y = _settings.height/2;

	stars.forEach(localStar => {
		if(localStar !== star){
			localStar.pos.X += x;
			localStar.pos.Y += y;
			localStar.velocity.dX += star.velocity.dX;
			localStar.velocity.dY += star.velocity.dY;
		}
	});

	star.velocity.dX = 0;
	star.velocity.dY = 0;

	return {x, y};
}
function gravityStars(timeDuration){
	if(timeDuration){
		const isEngineTimeAcceptable = engineTimeThreshold_ms < timeDuration;

		stars.forEach(star => {
			if(stars.indexOf(star) === -1){
				return;
			}

			let drag_x = 0;
			let drag_y = 0;
			stars.forEach(influenceStar => {
				if(star !== influenceStar){
					const drag = calculateDrag(star, influenceStar, timeDuration);
					drag_x += drag[0];
					drag_y += drag[1];
				}
			});
			star.velocity.dX += drag_x;
			star.velocity.dY += drag_y;
		});

		stars.forEach(star => {
			const velocity = star.velocity;

			const pos = star.pos;
			const x = pos.X + velocity.dX*timeDuration;
			const y = pos.Y + velocity.dY*timeDuration;

			const radius = star.radius;
			const isFarLeft = x < -radius;
			const isFarRight = _settings.width + radius < x;
			const isFarDown = y < -radius;
			const isFarUp = _settings.height + radius < y;
			if(isFarLeft || isFarRight || isFarDown || isFarUp){
				if(!_settings.frameTimeAcceptable && !isEngineTimeAcceptable && _centerOn !== star){
					const index = stars.indexOf(star);
					if(-1 < index){
						stars.splice(index, 1);
					}
				}
			}
			
			pos.X = x;
			pos.Y = y;
		});
	}
	if(_settings.doColorContamination){
		contaminateColor();
	}
}
function calculateDrag(star, influenceStar, timeDuration){
	let x = 0;
	let y = 0;

	const gravityDistance_x = influenceStar.pos.X - star.pos.X;
	const gravityDistance_y = influenceStar.pos.Y - star.pos.Y;

	const gravityDistance_square = gravityDistance_x*gravityDistance_x + gravityDistance_y*gravityDistance_y;

	if(0 < influenceStar.radius && gravityDistance_square < Math.pow(star.radius + influenceStar.radius, 2)){
		star.mergeWith(influenceStar);
	}else{
		const gravityForce = (star.mass * influenceStar.mass * _settings.gravityConstant) / gravityDistance_square;
		const gravityAcceleration = gravityForce / star.mass;

		const gravityDir = Math.atan2(gravityDistance_x, gravityDistance_y);

		let distanceTraveled = gravityAcceleration * timeDuration;
		distanceTraveled = distanceTraveled < 0.01 ? distanceTraveled : 0.01;

		x = Math.sin(gravityDir) * distanceTraveled;
		y = Math.cos(gravityDir) * distanceTraveled;
	}

	return [x, y];
}
function getDistance(x1, y1, x2, y2){
	return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}
function getNewStar(position, dir, speed=_settings.gravityConstant){
	if(dir === undefined){
		dir = Math.random()*2*Math.PI;
	}

	const star = new Star(position);
	star.velocity.dX = speed*Math.sin(dir);
	star.velocity.dY = speed*Math.cos(dir);

	if(!position){
		dir += Math.PI;
		const sin = Math.sin(dir);
		const cos = Math.cos(dir);
		const radius = star.radius;

		const isSinMajor = Math.max(Math.abs(sin), Math.abs(cos)) === Math.abs(sin);
		if(isSinMajor){	// Left or Right
			const x = sin < 0 ? 1-radius : _settings.width+radius-1;
			const y = Math.random()*_settings.height;
			star.pos = new Position(x, y);
		}else{
			const x = Math.random()*_settings.width;
			const y = cos < 0 ? 1-radius : _settings.height+radius-1;
			star.pos = new Position(x, y);
		}
	}

	return star;
}

onmessage = message => {
	onmessage = message => {
		_settings = message.data.settings;
		_queue = _queue.then(()=>{
			let offset = {x:0,y:0}
			if(_settings.centerOn === 'heaviest'){
				_centerOn = stars.sort((a, b)=>{return b.mass - a.mass})[0];
				offset = centerOnObject(_centerOn);
			}else if(_settings.centerOn === 'meanCenter' || _settings.centerOn === 'meanGravity'){
				let totalOffset = 0;
				const artificialStar = new Star();
				const calcWithGravity = _settings.centerOn === 'meanGravity';
				stars.forEach(star => {
					const offset = calcWithGravity ? star.mass : 1;
					totalOffset += offset;
					artificialStar.pos.X += star.pos.X * offset;
					artificialStar.pos.Y += star.pos.Y * offset;
				});
				artificialStar.pos.X /= totalOffset;
				artificialStar.pos.Y /= totalOffset;
				offset = centerOnObject(artificialStar);
			}
			postMessage({stars: stars.map(star => star.parse()), offset, centerOn: _centerOn?.parse(true)});
		});
	};
	onmessage(message);

	addStars(3);
	let timestamp = Date.now();
	function simulationEngine(){
		setTimeout(()=>{
			_queue = _queue.then(simulationEngine);
			let now = Date.now();
			const timeDuration = now - timestamp;
			timestamp = now;
			engineTimes.push(timeDuration);
			engineTimes.shift();
			if(_settings.frameTimeAcceptable && _skipAdd < 0 && getAverage(engineTimes) < engineTimeThreshold_ms){
				_skipAdd = engineTimes.length;
				if(_settings.maxStars === 0 || stars.length < _settings.maxStars){
					const newStar = getNewStar();
					newStar.color.R = Math.random()*255;
					newStar.color.G = Math.random()*255;
					newStar.color.B = Math.random()*255;
					stars.push(newStar);
				}
			}else{
				_skipAdd--;
			}
			gravityStars(timeDuration);
		});
	}
	simulationEngine();
}
