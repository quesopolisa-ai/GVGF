(function(){
  var menuView = document.getElementById('menuView');
  var gameView = document.getElementById('gameView');
  var canvas   = document.getElementById('gameCanvas');
  var ctx      = canvas.getContext('2d');
  var backBtn  = document.getElementById('backBtn');
  var W = canvas.width;
  var H = canvas.height;

  var current = null;

  function openGame(name){
    if(current){ current.stop(); current = null; }
    menuView.classList.add('hidden');
    gameView.classList.add('active');

    if(name === 'pong')       current = window.Pong(canvas, ctx, W, H);
    else if(name === 'sword') current = window.Sword(canvas, ctx, W, H);

    if(current) current.start();
  }

  function closeGame(){
    if(current){ current.stop(); current = null; }
    menuView.classList.remove('hidden');
    gameView.classList.remove('active');
  }

  document.getElementById('menu').addEventListener('click', function(e){
    var card = e.target.closest('.card');
    if(!card || card.classList.contains('locked')) return;
    var g = card.getAttribute('data-game');
    if(g) openGame(g);
  });

  backBtn.addEventListener('click', closeGame);
})();
