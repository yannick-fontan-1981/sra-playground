import type { LevelSpec } from './core.js';
export const SS03_LEVELS: readonly LevelSpec[] = [
  {
    "id": "ss03-01",
    "title": "L’atelier du Voleur",
    "facing": "S",
    "rows": [
      "~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~...~",
      "~~....~~~~~~~.g.~",
      "~~....~.o..~~...~",
      "~~.o..~....~~~D~~",
      "~~.T...........~~",
      "~~.........b...~~",
      "~~.b..~~.b.....~~",
      "~~....~~..#....~~",
      "~~....~~.....o.~~",
      "~~~~~~~~.......~~",
      "~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~"
    ]
  },
  {
    "id": "ss03-02",
    "title": "La presse latérale",
    "facing": "N",
    "rows": [
      "###########",
      "#......####",
      "#..o...####",
      "#....Dbb###",
      "#..#...####",
      "#...b..####",
      "#..o...Dg##",
      "#...T..####",
      "###########"
    ],
    "circuits": [
      {
        "id": "presse",
        "buttons": [
          {
            "x": 4,
            "y": 5
          }
        ]
      },
      {
        "id": "sortie",
        "buttons": [
          {
            "x": 6,
            "y": 3
          },
          {
            "x": 7,
            "y": 3
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 5,
          "y": 3
        },
        "circuit": "presse",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 7,
          "y": 6
        },
        "circuit": "sortie",
        "direction": "E",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss03-03",
    "title": "Les deux entrepôts",
    "rows": [
      "#############",
      "#...#o..#...#",
      "#T..o...#.o.#",
      "#...#..o....#",
      "##########.##",
      "#..oo...#...#",
      "#.g.#...#.b.#",
      "#...#...D.o.#",
      "#############"
    ]
  },
  {
    "id": "ss03-04",
    "title": "Le relais des deux terrasses",
    "rows": [
      "############",
      "#...###g..##",
      "#.T.o..##D##",
      "#...#......#",
      "####...ob..#",
      "#.....#....#",
      "#.b...###D##",
      "#...###...##",
      "############"
    ]
  },
  {
    "id": "ss03-05",
    "title": "Les alcôves de la cathédrale",
    "rows": [
      "#############",
      "#####....o###",
      "######..#####",
      "#g.#.b......#",
      "#..DT...b.#.#",
      "#..#........#",
      "######..#####",
      "######..o####",
      "#############"
    ]
  },
  {
    "id": "ss03-06",
    "title": "Trois amarres",
    "rows": [
      "#########",
      "#.....#g#",
      "#.To..#D#",
      "#.oo....#",
      "#.#...#.#",
      "#.b.b.b.#",
      "#...#...#",
      "#########"
    ]
  },
  {
    "id": "ss03-07",
    "title": "Les deux presses",
    "facing": "S",
    "rows": [
      "################",
      "##########b#..##",
      "####...o.bD....#",
      "####.o.........#",
      "###b.T.........#",
      "####.b....b....#",
      "####........o..#",
      "#######........#",
      "#######.......D#",
      "##############g#",
      "################"
    ],
    "circuits": [
      {
        "id": "presse-ouest",
        "buttons": [
          {
            "x": 5,
            "y": 5
          }
        ]
      },
      {
        "id": "presse-nord",
        "buttons": [
          {
            "x": 9,
            "y": 2
          },
          {
            "x": 10,
            "y": 5
          }
        ]
      },
      {
        "id": "sortie",
        "buttons": [
          {
            "x": 3,
            "y": 4
          },
          {
            "x": 10,
            "y": 1
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 5,
          "y": 4
        },
        "circuit": "presse-ouest",
        "direction": "W",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 10,
          "y": 2
        },
        "circuit": "presse-nord",
        "direction": "N",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 14,
          "y": 8
        },
        "circuit": "sortie",
        "direction": "N",
        "closedWhen": "released"
      }
    ]
  },
  {
    "title": "Le train des six caisses",
    "rows": [
      "#####g...",
      "....###o.",
      "oT..###..",
      "....###.#",
      ".o......#",
      "...#..o.#",
      "####....#",
      "........o",
      ".o.......",
      "........."
    ],
    "circuits": [
      {
        "id": "A",
        "buttons": [
          {
            "x": 1,
            "y": 4
          }
        ]
      },
      {
        "id": "B",
        "buttons": [
          {
            "x": 6,
            "y": 5
          }
        ]
      }
    ],
    "id": "ss03-08",
    "facing": "S",
    "gates": [
      {
        "at": {
          "x": 7,
          "y": 4
        },
        "circuit": "B",
        "direction": "W",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 3,
          "y": 4
        },
        "circuit": "A",
        "direction": "N",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 6,
          "y": 0
        },
        "circuit": "A",
        "direction": "N",
        "closedWhen": "released"
      }
    ]
  }
];
