import requests
import json
import pprint
import random
import html as h

score_correct = 0
score_incorrect = 0

url = ("https://opentdb.com/api.php?amount=1&category=28&type=multiple")

endgame = ""

while endgame != "quit":
    r = requests.get(url)

    if (r.status_code != 200):
        endgame = input("Sorry, there was a problem with the game. Press enter to try again or 'quit' to quit")
    else:
        answer_number = 1
        data = json.loads(r.text)
        question = data['results'][0]['question']
        answers = data['results'][0]['incorrect_answers']
        correct_answer = data['results'][0]['correct_answer']
        answers.append(correct_answer)
        random.shuffle(answers)

        print("\n" + h.unescape(question) + "\n")

        for answer in answers:
            print(str(answer_number) + "-" + answer)
            answer_number += 1
        user_answer = input("\nType the number of the correct answer: ")

        user_answer = answers[int(user_answer)-1]

        if user_answer == correct_answer:
            print("\nNice Job! That was the correct answer: " + correct_answer)
            score_correct += 1
        else:
            print("Sorry " + user_answer + " is incorrect. The correct answer is " + h.unescape(correct_answer))
            score_incorrect += 1

        print("\n########################")
        print("\Correct scores: " + str(score_correct))
        print("\nIncorrect scores: " + str(score_incorrect))
        print("\n########################")

        endgame = input("\nPress enter to play again or type 'quit' to exit the game: ")

print("Thanks for playing")
