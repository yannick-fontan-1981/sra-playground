import type {LevelSpec} from './core.js';
export const SS13_LEVELS:readonly LevelSpec[]=[
  {
    "id": "ss13-01",
    "title": "L’atelier de l’ancre verte",
    "rows": [
      "####################",
      "#..........~~~######",
      "#.o........~~~######",
      "#.T..1.....~~~######",
      "#..........~~~######",
      "#...Z...2..~.......#",
      "#..........~.......#",
      "#..........~.......#",
      "#..........~.......#",
      "#..o....o..~....gg.#",
      "#.......#..~.......#",
      "#..m.m.....~.......#",
      "#..........~.......#",
      "#..........~~~######",
      "###########~~~######",
      "####################",
      "####################"
    ],
    "circuits": [
      {
        "id": "atelier",
        "buttons": [
          {
            "x": 2,
            "y": 7
          }
        ],
        "color": 10
      }
    ],
    "gates": [
      {
        "at": {
          "x": 3,
          "y": 9
        },
        "circuit": "atelier",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 3,
          "y": 11
        },
        "circuit": "atelier",
        "direction": "E",
        "closedWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss13-02",
    "title": "Une place de plus sur l’autre rive",
    "rows": [
      "~~~~~~~~~~~~~~",
      "~.....~......~",
      "~.....~......~",
      "~..2..~......~",
      "~.T...~......~",
      "~..Z..~..o...~",
      "~.....~~~.~~~~",
      "~.....~~~....~",
      "~.....~~~..gg~",
      "~.....~~~....~",
      "~~~~~~~~~~~~~~"
    ],
    "circuits": [
      {
        "id": "ancre",
        "buttons": [
          {
            "x": 8,
            "y": 3
          }
        ],
        "color": 14
      }
    ],
    "gates": [
      {
        "at": {
          "x": 9,
          "y": 6
        },
        "circuit": "ancre",
        "direction": "S",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss13-03",
    "title": "La cellule et les trois relèves",
    "rows": [
      "###################",
      "###################",
      "###############...#",
      "###T###########.gg#",
      "###~########...#.##",
      "###~########......#",
      "###~####o.........#",
      "###~########......#",
      "###~#########.#####",
      "###~#########.#####",
      "#....#............#",
      "#....#............#",
      "#..Z.#............#",
      "#.......o.........#",
      "#........#........#",
      "#........#........#",
      "#........#........#",
      "#.................#",
      "###################"
    ],
    "circuits": [
      {
        "id": "anchor",
        "buttons": [
          {
            "x": 3,
            "y": 3
          }
        ],
        "color": 9
      },
      {
        "id": "extraction",
        "buttons": [
          {
            "x": 15,
            "y": 6
          }
        ],
        "color": 14
      },
      {
        "id": "exit",
        "buttons": [
          {
            "x": 13,
            "y": 5
          }
        ],
        "color": 11
      }
    ],
    "gates": [
      {
        "at": {
          "x": 13,
          "y": 8
        },
        "circuit": "anchor",
        "direction": "S",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 10,
          "y": 6
        },
        "circuit": "extraction",
        "direction": "W",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 16,
          "y": 4
        },
        "circuit": "exit",
        "direction": "S",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss13-04",
    "title": "Le miroir reste à quai",
    "rows": [
      "~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~...~~~~",
      "~~~~~~~~~~~~~.Z.~~~~",
      "~~~~~~~~~~~~~...~~~~",
      "~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~....~~~~~~~~~",
      "~~~~~~~..o.~.....~~~",
      "~~~~~~~....~.....~~~",
      "~~~2~~~....~..o..~~~",
      "~~~T~~~....~.....~~~",
      "~~~.~...~~~~~~~~~~~~",
      "~~~.~g~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~..#..~~~....~~",
      "~~~~~~.o#..~~~..g.~~",
      "~~~~~~..#.........~~",
      "~~~~~~.....~~~....~~",
      "~~~~~~~~~~~~~~....~~",
      "~~~~~~~~~~~~~~~~~~~~"
    ],
    "circuits": [
      {
        "id": "return-anchor",
        "buttons": [
          {
            "x": 14,
            "y": 2
          }
        ],
        "color": 15
      },
      {
        "id": "mirror-mooring",
        "buttons": [
          {
            "x": 5,
            "y": 10
          }
        ],
        "color": 9
      }
    ],
    "gates": [
      {
        "at": {
          "x": 11,
          "y": 15
        },
        "circuit": "mirror-mooring",
        "direction": "W",
        "closedWhen": "released"
      }
    ],
    "platforms": [
      {
        "at": {
          "x": 4,
          "y": 10
        },
        "circuit": "return-anchor",
        "activeWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss13-05",
    "title": "Le gardien devenu poids",
    "rows": [
      "~~~~~~~~~~~~~~~~~~~~",
      "~.....~~~~~~~~~~~~~~",
      "~.....~~......~~~~~~",
      "~.T...~~......~~~~~~",
      "~...Z.~~...m..~~~~~~",
      "~.....~~......~~~~~~",
      "~.....~~......~....~",
      "~.....~~o.....~..g.~",
      "~.....~~......~....~",
      "~.....~~......~..g.~",
      "~~.#~~~~~~~~~~~....~",
      "~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~"
    ],
    "facing": "E",
    "mirrors": [
      {
        "at": {
          "x": 2,
          "y": 10
        },
        "facing": "NE"
      }
    ],
    "circuits": [
      {
        "id": "deux-poids",
        "buttons": [
          {
            "x": 4,
            "y": 4
          },
          {
            "x": 11,
            "y": 7
          }
        ],
        "color": 10
      }
    ],
    "platforms": [
      {
        "at": {
          "x": 14,
          "y": 8
        },
        "circuit": "deux-poids",
        "activeWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss13-06",
    "title": "La presse délivre le tireur",
    "rows": [
      "~~~~~~~~~~~~~~~~~~~~",
      "~.........~~~~~~.g.~",
      "~.Z.......~~~~~~..g~",
      "~.........~~~~~~~~~~",
      "~.........~#~......~",
      "~....oT.....~......~",
      "~.........~#.......~",
      "~.........~~~......~",
      "~.........~~~..##..~",
      "~.........~~~.#m...~",
      "~.........~~~..##..~",
      "~~~~~~~~~~~~~....o.~",
      "~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~"
    ],
    "facing": "E",
    "circuits": [
      {
        "id": "chargement",
        "buttons": [
          {
            "x": 4,
            "y": 9
          }
        ],
        "color": 0
      },
      {
        "id": "premiere-caisse",
        "buttons": [
          {
            "x": 11,
            "y": 5
          }
        ],
        "color": 10
      },
      {
        "id": "depot",
        "buttons": [
          {
            "x": 14,
            "y": 6
          }
        ],
        "color": 15
      },
      {
        "id": "derniere-caisse",
        "buttons": [
          {
            "x": 16,
            "y": 9
          }
        ],
        "color": 14
      }
    ],
    "gates": [
      {
        "at": {
          "x": 10,
          "y": 5
        },
        "circuit": "chargement",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 17,
          "y": 9
        },
        "circuit": "depot",
        "direction": "W",
        "closedWhen": "pressed"
      }
    ],
    "platforms": [
      {
        "at": {
          "x": 12,
          "y": 5
        },
        "circuit": "chargement",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 10,
          "y": 8
        },
        "circuit": "premiere-caisse",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 11,
          "y": 8
        },
        "circuit": "premiere-caisse",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 12,
          "y": 8
        },
        "circuit": "premiere-caisse",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 17,
          "y": 3
        },
        "circuit": "derniere-caisse",
        "activeWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss13-07",
    "title": "L’amarre et les trois diagonales",
    "rows": [
      "~~~~~~~~~#~~~~~~~~~~",
      "~~g##...#.#...o~~~~~",
      "~~...o.........~~~~~",
      "~~g##..........~...~",
      "~~.##..........~...~",
      "~~~~~~~~~~~~~~~~...~",
      "~~~~~~~~~~~~~~~~...~",
      "~~.............~...~",
      "~~.............~...~",
      "~~.......~.....~...~",
      "~~........~#...~...~",
      "~~.......#.....~...~",
      "~~~~~~~~~~~~~~~~~~~~",
      "~~.............~~~~~",
      "~~.Z...........~~~~~",
      "~~.~...........~~~~~",
      "~~...T...o.....~~~~~",
      "~~#o#..........~~~~~",
      "~~.#...........~~~~~",
      "~~~~~~~~~~~~~~~~~~~~"
    ],
    "facing": "W",
    "mirrors": [
      {
        "at": {
          "x": 6,
          "y": 16
        },
        "facing": "NE"
      }
    ],
    "circuits": [
      {
        "id": "amarre",
        "buttons": [
          {
            "x": 3,
            "y": 17
          }
        ],
        "color": 11
      },
      {
        "id": "presse",
        "buttons": [
          {
            "x": 7,
            "y": 9
          }
        ],
        "color": 9
      },
      {
        "id": "sceau",
        "buttons": [
          {
            "x": 9,
            "y": 1
          },
          {
            "x": 17,
            "y": 6
          }
        ],
        "color": 10
      }
    ],
    "gates": [
      {
        "at": {
          "x": 8,
          "y": 10
        },
        "circuit": "presse",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 4,
          "y": 2
        },
        "circuit": "sceau",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 3,
          "y": 2
        },
        "circuit": "amarre",
        "direction": "E",
        "closedWhen": "pressed"
      }
    ],
    "platforms": [
      {
        "at": {
          "x": 5,
          "y": 5
        },
        "circuit": "amarre",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 11,
          "y": 5
        },
        "circuit": "amarre",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 12,
          "y": 5
        },
        "circuit": "amarre",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 15,
          "y": 10
        },
        "circuit": "amarre",
        "activeWhen": "released"
      },
      {
        "at": {
          "x": 10,
          "y": 10
        },
        "circuit": "presse",
        "activeWhen": "released"
      }
    ]
  },
  {
    "id": "ss13-08",
    "title": "Les deux retours de l’ancre",
    "rows": [
      "~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~..~",
      "~~~~~~~~~~~....~~g.~",
      "~~~~~~~~~~~.....~.g~",
      "~~~~~~~~~~~.....~..~",
      "~~~~~~~~~~~....~~#.~",
      "~~~~~~~~#~~m...~~..~",
      "~........~~....~~~~~",
      "~.....#..~~....~~~~~",
      "~....#m#.~~....~~~~~",
      "~.Z...o..~~...o....~",
      "~.....T..~~........~",
      "~........~~........~",
      "~.......~~~........~",
      "~........~~~~~~~~.~~",
      "~~~~~~~#.~~~~~~~~.~~",
      "~~~~~~~#.#~~~~~~~~~~",
      "~~~~~~~~#~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~"
    ],
    "facing": "S",
    "mirrors": [
      {
        "at": {
          "x": 8,
          "y": 16
        },
        "facing": "NE"
      },
      {
        "at": {
          "x": 14,
          "y": 6
        },
        "facing": "SW"
      }
    ],
    "circuits": [
      {
        "id": "ancre-vivante",
        "buttons": [
          {
            "x": 14,
            "y": 8
          },
          {
            "x": 14,
            "y": 10
          }
        ],
        "color": 10
      },
      {
        "id": "retour",
        "buttons": [
          {
            "x": 12,
            "y": 7
          }
        ],
        "color": 15
      },
      {
        "id": "dernier-miroir",
        "buttons": [
          {
            "x": 8,
            "y": 12
          }
        ],
        "color": 14
      },
      {
        "id": "presse",
        "buttons": [
          {
            "x": 12,
            "y": 2
          }
        ],
        "color": 0
      }
    ],
    "gates": [
      {
        "at": {
          "x": 8,
          "y": 14
        },
        "circuit": "retour",
        "direction": "S",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 14,
          "y": 6
        },
        "circuit": "presse",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 17,
          "y": 6
        },
        "circuit": "dernier-miroir",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 18,
          "y": 6
        },
        "circuit": "retour",
        "direction": "N",
        "closedWhen": "pressed"
      }
    ],
    "platforms": [
      {
        "at": {
          "x": 8,
          "y": 13
        },
        "circuit": "ancre-vivante",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 16,
          "y": 15
        },
        "circuit": "ancre-vivante",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 16,
          "y": 6
        },
        "circuit": "ancre-vivante",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 9,
          "y": 12
        },
        "circuit": "retour",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 10,
          "y": 12
        },
        "circuit": "retour",
        "activeWhen": "pressed"
      }
    ]
  }
];
